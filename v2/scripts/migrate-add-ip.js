import sql from '../lib/db.js';

/**
 * Migration: Add ip column to analytics table
 * Run: node --env-file=.env.local scripts/migrate-add-ip.js
 */
export async function migrateAddIpColumn() {
  try {
    console.log('🔄 Checking analytics table structure...');
    
    // Check if column exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='analytics' AND column_name='ip'
    `;

    if (checkColumn.length > 0) {
      console.log('✅ Column "ip" already exists in analytics table');
      return true;
    }

    console.log('📝 Adding ip column to analytics table...');
    
    // Add ip column
    await sql`
      ALTER TABLE analytics 
      ADD COLUMN ip TEXT
    `;

    console.log('✅ Successfully added ip column to analytics table');
    
    // Add index for ip if not exists
    await sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_ip ON analytics(ip)
    `;
    
    console.log('✅ Added index on ip column');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

// Run migration
const success = await migrateAddIpColumn();
process.exit(success ? 0 : 1);
