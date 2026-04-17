/**
 * Seed script: imports profiles.json → Neon PostgreSQL and bulk-uploads photos to Cloudflare R2.
 * 
 * Usage:
 *   1. Set DATABASE_URL and R2 credentials in .env.local
 *   2. Run: npm run seed
 */

import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const DATABASE_URL = process.env.DATABASE_URL;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set in .env.local'); process.exit(1); }
if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
  console.warn('⚠️  R2 credentials not set — photos will be stored with local paths only.');
}

const sql = neon(DATABASE_URL);

function normalizePhotoPath(path) {
  if (!path) return '';
  let p = String(path).trim().replace(/\\\\/g, '/');
  const m = p.match(/(?:^|\/)(photos\/.*)$/i);
  if (m) return `assests/${m[1]}`;
  p = p.replace(/^reunion_output\//i, '').replace(/^\.\//, '');
  if (/^photos\//i.test(p)) return `assests/${p}`;
  if (/^assests\/photos\//i.test(p)) return p;
  return p;
}

async function uploadToR2(filePath) {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) return null;
  
  const fullPath = resolve(ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.warn(`  ⚠️  File not found: ${fullPath}`);
    return null;
  }

  try {
    const fileBuffer = readFileSync(fullPath);
    const fileName = basename(fullPath);
    const key = `photos/${fileName}`;

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });

    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/jpeg',
    }));

    return `${R2_ENDPOINT}/${key}`;
  } catch (err) {
    console.warn(`  ⚠️  Upload failed for ${filePath}: ${err.message}`);
    return null;
  }
}

async function main() {
  // 1. Read profiles.json
  const profilesPath = resolve(ROOT, 'assests', 'profiles.json');
  if (!existsSync(profilesPath)) {
    console.error(`❌ profiles.json not found at: ${profilesPath}`);
    process.exit(1);
  }

  const profiles = JSON.parse(readFileSync(profilesPath, 'utf-8'));
  console.log(`📋 Loaded ${profiles.length} profiles from profiles.json`);

  // 2. Create tables
  console.log('📦 Creating database tables...');
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      student_id TEXT DEFAULT '',
      blood TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      location TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      visible BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      member_id TEXT,
      member_name TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      country TEXT,
      city TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_members_student_id ON members(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_members_visible ON members(visible)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC)`;
  console.log('✅ Tables ready');

  // 3. Cache existing R2 URLs so we don't re-upload
  const existingMembers = await sql`SELECT student_id, photo FROM members`;
  const r2Cache = new Map();
  for (const m of existingMembers) {
    if (m.photo && m.photo.includes('.r2.cloudflarestorage.com')) {
      r2Cache.set(m.student_id, m.photo);
    }
  }
  if (r2Cache.size > 0) {
    console.log(`💾 Found ${r2Cache.size} existing R2 URLs — will skip re-uploading`);
  }

  // 4. Clear existing members
  if (existingMembers.length > 0) {
    console.log(`🗑️  Clearing ${existingMembers.length} existing members...`);
    await sql`DELETE FROM members`;
  }

  // 5. Process each profile
  let uploadedCount = 0;
  let skippedCount = 0;
  let reusedCount = 0;

  // Process in batches of 50 for INSERT
  const BATCH_SIZE = 50;
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    const values = [];

    for (let j = 0; j < batch.length; j++) {
      const p = batch[j];
      const photoPath = normalizePhotoPath(p.photo);
      let finalPhotoUrl = photoPath;

      if (photoPath && r2Cache.has(p.ID)) {
        finalPhotoUrl = r2Cache.get(p.ID);
        reusedCount++;
        process.stdout.write(`\r♻️  Reusing cached photo ${i + j + 1}/${profiles.length}...`);
      } else if (photoPath) {
        process.stdout.write(`\r📸 Uploading photo ${i + j + 1}/${profiles.length}...`);
        const r2Url = await uploadToR2(photoPath);
        if (r2Url) {
          finalPhotoUrl = r2Url;
          uploadedCount++;
        } else {
          skippedCount++;
        }
      }

      values.push({
        name: p.Name || '',
        email: p.Email || '',
        mobile: p.Mobile || '',
        student_id: p.ID || '',
        blood: p.Blood || '',
        designation: p.Designation || '',
        organization: p.Organization || '',
        location: p.Location || '',
        photo: finalPhotoUrl,
      });
    }

    // Insert batch
    for (const v of values) {
      await sql`
        INSERT INTO members (name, email, mobile, student_id, blood, designation, organization, location, photo, visible)
        VALUES (${v.name}, ${v.email}, ${v.mobile}, ${v.student_id}, ${v.blood}, ${v.designation}, ${v.organization}, ${v.location}, ${v.photo}, true)
      `;
    }
  }

  console.log(''); // newline after progress

  // 6. Verify
  const countResult = await sql`SELECT COUNT(*) as count FROM members`;
  const totalInserted = Number(countResult[0].count);

  // 7. Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Seed Complete!`);
  console.log(`   Members: ${totalInserted}`);
  console.log(`   Photos uploaded to R2: ${uploadedCount}`);
  console.log(`   Photos reused from cache: ${reusedCount}`);
  console.log(`   Photos skipped: ${skippedCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
