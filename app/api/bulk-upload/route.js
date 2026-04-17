import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { read, utils } from 'xlsx';
import { isAdmin, adminUnauthorized } from '@/lib/auth';
import sql from '@/lib/db';

export const maxDuration = 60; // Allow up to 60 seconds

// ─── column aliases ────────────────────────────────────────────────────────────
// The Excel columns can use ANY of these names (case-insensitive).
const FIELD_MAP = {
  Name:         ['name', 'full name', 'fullname', 'member name'],
  ID:           ['id', 'student id', 'studentid', 'roll', 'student_id'],
  Email:        ['email', 'e-mail', 'mail'],
  Mobile:       ['mobile', 'phone', 'contact', 'cell'],
  Blood:        ['blood', 'blood group', 'bloodgroup'],
  Designation:  ['designation', 'title', 'job title', 'jobtitle', 'position'],
  Organization: ['organization', 'company', 'institution', 'org'],
  Location:     ['location', 'city', 'address', 'place'],
  Photo:        ['photo', 'image', 'picture', 'pic', 'img', 'photo filename', 'image filename'],
};

/**
 * Normalise a raw header string to a key we care about, or null.
 */
function mapHeader(raw) {
  const lower = String(raw ?? '').trim().toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.includes(lower)) return field;
  }
  return null;
}

export async function POST(request) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const formData = await request.formData();
    const excelFile  = formData.get('excel');
    const photosZip  = formData.get('photos'); // optional ZIP

    if (!excelFile) {
      return Response.json({ error: 'No Excel file provided' }, { status: 400 });
    }

    // ── 1. Parse Excel ─────────────────────────────────────────────────────────
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const workbook    = read(excelBuffer, { type: 'buffer' });
    const sheet       = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows     = utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length < 2) {
      return Response.json({ error: 'Excel file is empty or has no data rows' }, { status: 400 });
    }

    // Map header row → field keys
    const headerRow = rawRows[0];
    const headers   = headerRow.map(mapHeader); // array of field keys or null

    // ── 2. Extract photo files from ZIP (if provided) ──────────────────────────
    /** @type {Map<string, Uint8Array>} filename (lowercase) → bytes */
    const photoMap = new Map();

    if (photosZip && photosZip.size > 0) {
      // We use a pure-JS approach: stream the ZIP manually.
      // Since we don't have 'jszip' installed we use the built-in
      // Compression Streams API available in Node 18 / Edge.
      // Fallback: we iterate through formData entries for individually
      // uploaded photo files if the admin sends them as separate fields.
      try {
        const zipBytes = new Uint8Array(await photosZip.arrayBuffer());
        const entries  = await parseZip(zipBytes);
        for (const [name, bytes] of entries) {
          photoMap.set(name.split('/').pop().toLowerCase(), bytes);
        }
      } catch {
        // ZIP parse failed – proceed without photos
      }
    }

    // Also pick up any individually submitted photo files
    // (field names like "photo_99406", "photo_99407", …)
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo_') && value instanceof File) {
        photoMap.set(value.name.toLowerCase(), new Uint8Array(await value.arrayBuffer()));
      }
    }

    // ── 3. Process each data row ───────────────────────────────────────────────
    const results  = { added: 0, skipped: 0, errors: [] };
    const dataRows = rawRows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Build a record from the mapped columns
      const rec = { Name: '', ID: '', Email: '', Mobile: '', Blood: '', Designation: '', Organization: '', Location: '', Photo: '' };
      headers.forEach((field, colIdx) => {
        if (field && rec[field] !== undefined) {
          rec[field] = String(row[colIdx] ?? '').trim();
        }
      });

      // Skip completely empty rows
      if (!rec.Name && !rec.ID) { results.skipped++; continue; }

      // ── 3a. Upload photo if we have matching bytes ─────────────────────────
      let photoUrl = '';
      if (rec.Photo) {
        const key   = rec.Photo.toLowerCase();
        const bytes = photoMap.get(key);
        if (bytes) {
          try {
            const ext = key.split('.').pop() || 'jpg';
            const filename = `photos/${rec.ID || `row${i + 2}`}_${Date.now()}.${ext}`;

            const s3Client = new S3Client({
              region: 'auto',
              endpoint: process.env.R2_ENDPOINT,
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
              },
            });

            await s3Client.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: filename,
              Body: Buffer.from(bytes),
              ContentType: `image/${ext}`,
            }));

            photoUrl = `${process.env.R2_ENDPOINT}/${filename}`;
          } catch (err) {
            results.errors.push(`Row ${i + 2}: photo upload failed for ${rec.Photo}`);
          }
        }
      }

      // ── 3b. Insert into DB ────────────────────────────────────────────────
      try {
        await sql`
          INSERT INTO members (name, email, mobile, student_id, blood, designation, organization, location, photo, visible)
          VALUES (
            ${rec.Name}, ${rec.Email}, ${rec.Mobile}, ${rec.ID},
            ${rec.Blood}, ${rec.Designation}, ${rec.Organization},
            ${rec.Location}, ${photoUrl}, true
          )
        `;
        results.added++;
      } catch (dbErr) {
        results.errors.push(`Row ${i + 2} (${rec.Name || rec.ID}): ${dbErr.message}`);
        results.skipped++;
      }
    }

    return Response.json(results);
  } catch (err) {
    return Response.json({ error: 'Bulk upload failed' }, { status: 500 });
  }
}

// ─── Minimal ZIP parser (PKZIP local-file-header walk) ────────────────────────
async function parseZip(bytes) {
  const entries = new Map();
  const view    = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let   offset  = 0;

  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // local file header signature

    const flags          = view.getUint16(offset + 6,  true);
    const compression    = view.getUint16(offset + 8,  true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fnLen          = view.getUint16(offset + 26, true);
    const extraLen       = view.getUint16(offset + 28, true);
    const decoder        = new TextDecoder(flags & 0x800 ? 'utf-8' : 'ascii');
    const filename       = decoder.decode(bytes.subarray(offset + 30, offset + 30 + fnLen));

    const dataStart = offset + 30 + fnLen + extraLen;
    const dataEnd   = dataStart + compressedSize;
    const chunk     = bytes.subarray(dataStart, dataEnd);

    if (!filename.endsWith('/')) {
      if (compression === 0) {
        // STORED
        entries.set(filename, chunk);
      } else if (compression === 8) {
        // DEFLATE – use DecompressionStream
        const ds     = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(chunk);
        writer.close();
        const parts = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
        }
        const total = parts.reduce((s, p) => s + p.length, 0);
        const out   = new Uint8Array(total);
        let   pos   = 0;
        for (const p of parts) { out.set(p, pos); pos += p.length; }
        entries.set(filename, out);
      }
    }
    offset = dataEnd;
  }
  return entries;
}
