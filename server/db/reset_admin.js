// Reset admin user in Supabase with correct PBKDF2 password hash
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node server/db/reset_admin.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

function hashPassword(pw) {
  return crypto.pbkdf2Sync(pw, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

const username = 'UKHPV2026';
const password = 'UKHPV@2026';
const hash = hashPassword(password);

const { error } = await supabase.from('admin_users').upsert([{
  id: 'usr-admin-1',
  username,
  password_hash: hash,
  name: 'State HPV Administrator',
  role: 'SUPER_ADMIN',
  is_active: true
}], { onConflict: 'username' });

if (error) {
  console.error('❌ Error:', error.message);
} else {
  console.log(`✅ Admin user updated successfully`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
}
