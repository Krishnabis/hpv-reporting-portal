import { supabase } from './db/database.js';

async function test() {
  console.log('Testing Supabase query...');
  const { data, error } = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name), district_id, districts(name)').order('created_at', { ascending: false });
  console.log('Error:', error);
  process.exit(0);
}

test();
