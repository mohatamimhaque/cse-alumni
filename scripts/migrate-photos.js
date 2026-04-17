/**
 * migrate-photos.js
 * 
 * Finds every member whose photo is a local path (not an R2 URL),
 * uploads it to Cloudflare R2, and updates the DB record.
 * 
 * Run ONCE to migrate all photos to R2:
 *   node scripts/migrate-photos.js
 */

import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env.local
const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const DATABASE_URL       = process.env.DATABASE_URL;
const R2_ENDPOINT        = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID   = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME     = process.env.R2_BUCKET_NAME;
const ROOT               = resolve(__dirname, '../..'); // reunion_output/

if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
  console.error('❌ R2 credentials not set'); process.exit(1);
}

const sql = neon(DATABASE_URL);

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

async function main() {
  // 1. Fetch members with local (non-blob) photo paths
  const members = await sql`SELECT id, name, student_id, photo FROM members`;
  const local = members.filter(
    (m) => m.photo && !m.photo.startsWith('http://') && !m.photo.startsWith('https://')
  );

  console.log(`\n📋 Total members: ${members.length}`);
  console.log(`📸 Members with local photo paths: ${local.length}\n`);

  if (local.length === 0) {
    console.log('✅ All photos already have R2 URLs — nothing to do.');
    process.exit(0);
  }

  let uploaded = 0, skipped = 0, failed = 0;

  for (let i = 0; i < local.length; i++) {
    const m = local[i];
    const photoPath = m.photo.replace(/\\/g, '/').replace(/^\/+/, '');
    const abs = resolve(ROOT, photoPath);

    process.stdout.write(`\r[${i + 1}/${local.length}] ${m.name || m.student_id}...`);

    if (!existsSync(abs)) {
      console.log(`\n  ⚠️  File not found: ${abs}`);
      skipped++;
      continue;
    }

    try {
      const buf  = readFileSync(abs);
      const ext  = extname(abs).toLowerCase();
      const mime = MIME[ext] || 'image/jpeg';
      const name = `${m.student_id || `id${m.id}`}_${basename(abs)}`;
      const key  = `photos/${name}`;

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
        Body: buf,
        ContentType: mime,
      }));

      const r2Url = `${R2_ENDPOINT}/${key}`;
      // Update DB
      await sql`UPDATE members SET photo = ${r2Url}, updated_at = NOW() WHERE id = ${m.id}`;
      uploaded++;
    } catch (err) {
      console.log(`\n  ❌ Failed for ${m.name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Migration complete!');
  console.log(`   Uploaded to R2   : ${uploaded}`);
  console.log(`   File not found   : ${skipped}`);
  console.log(`   Errors           : ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
