import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Please add your DATABASE_URL to .env.local');
}

const sql = neon(databaseUrl);

export default sql;

/**
 * Initialize database tables (called by seed script and on first request)
 */
export async function initDb() {
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
      ip TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      country TEXT,
      city TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_members_student_id ON members(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_members_visible ON members(visible)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(type, timestamp DESC)`;
}

/**
 * Convert a DB row to the frontend member format (PascalCase keys + _id)
 */
export function toMember(row) {
  return {
    _id: row.id,
    Name: row.name,
    Email: row.email,
    Mobile: row.mobile,
    ID: row.student_id,
    Blood: row.blood,
    Designation: row.designation,
    Organization: row.organization,
    Location: row.location,
    photo: row.photo,
    visible: row.visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
