// Fixes admin password hash using direct PostgreSQL connection (bypasses Supabase JS)
import pkg from 'pg';
const { Client } = pkg;
import crypto from 'crypto';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ Set DATABASE_URL env var');
  process.exit(1);
}

function hashPassword(pw) {
  return crypto.pbkdf2Sync(pw, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

const username = 'UKHPV2026';
const password = 'UKHPV@2026';
const hash = hashPassword(password);

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  INSERT INTO admin_users (id, username, password_hash, name, role, is_active)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active
`, ['usr-admin-1', username, hash, 'State HPV Administrator', 'SUPER_ADMIN', true]);

console.log('✅ Admin password updated in Supabase');
console.log(`   Username: ${username}`);
console.log(`   Password: ${password}`);
await client.end();
