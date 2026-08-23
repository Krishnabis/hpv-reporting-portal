import { supabase } from './db/database.js';

async function test() {
  const { data, error } = await supabase.from('admin_users').select('non_existent_column').limit(1);
  console.log('Error:', error);
  process.exit(0);
}

test();
