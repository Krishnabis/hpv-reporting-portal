// One-time Supabase setup: creates schema + seeds all data
// Usage: DATABASE_URL=<your-url> node server/db/setup_supabase.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL environment variable is required.');
  console.error('   Usage: DATABASE_URL=<your-supabase-url> node server/db/setup_supabase.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to Supabase PostgreSQL');

    // Run schema
    console.log('\n📐 Creating schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema_pg.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema created');

    // Run seed
    console.log('\n🌱 Seeding data...');
    const seed = fs.readFileSync(path.join(__dirname, 'seed_pg.sql'), 'utf8');
    await client.query(seed);
    console.log('✅ Data seeded');

    // Verify counts
    const states = await client.query('SELECT COUNT(*) FROM states');
    const districts = await client.query('SELECT COUNT(*) FROM districts');
    const blocks = await client.query('SELECT COUNT(*) FROM blocks');
    const admins = await client.query('SELECT COUNT(*) FROM admin_users');

    console.log('\n📊 Database summary:');
    console.log(`   States:    ${states.rows[0].count}`);
    console.log(`   Districts: ${districts.rows[0].count}`);
    console.log(`   Blocks:    ${blocks.rows[0].count}`);
    console.log(`   Admins:    ${admins.rows[0].count}`);
    console.log('\n🎉 Supabase setup complete! Production is ready.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
