import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Please provide database URL as argument');
  process.exit(1);
}

console.log('⚡ Connecting to Railway PostgreSQL Database...');

const pool = new Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 10000,
  ssl: dbUrl.includes('railway.internal') ? false : { rejectUnauthorized: false }
});

async function runDeploy() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to Railway PostgreSQL!');

    const schemaPath = path.join(__dirname, 'schema_pg.sql');
    const seedPath = path.join(__dirname, 'seed_pg.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('📜 Executing PostgreSQL Schema...');
    await client.query(schemaSql);
    console.log('✅ Schema Executed Successfully!');

    console.log('🌱 Executing PostgreSQL Seed Data...');
    await client.query(seedSql);
    console.log('✅ Seed Data Inserted Successfully!');

    // Verification
    const resBlocks = await client.query('SELECT COUNT(*) FROM blocks');
    const resDistricts = await client.query('SELECT COUNT(*) FROM districts');
    const resAdmin = await client.query('SELECT username, role FROM admin_users');

    console.log('\n--- VERIFICATION RESULT ---');
    console.log(`📍 Districts Count: ${resDistricts.rows[0].count}`);
    console.log(`📍 Blocks Count: ${resBlocks.rows[0].count}`);
    console.log(`🔑 Admin Users:`, resAdmin.rows);

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Railway Deployment Error:', err.message);
    process.exit(1);
  }
}

runDeploy();
