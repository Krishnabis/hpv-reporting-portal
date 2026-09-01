import { supabase } from './db/database.js';
async function run() {
  const { data, error } = await supabase.from('admin_users').select('id, vaccine_ccp(facility_name, districts(name))').limit(1);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
