import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('vaccine_ccp').select('unit_level');
  console.log('Error:', error);
  const counts = {};
  data.forEach(d => { counts[d.unit_level] = (counts[d.unit_level] || 0) + 1 });
  console.log('Unit Level Counts:', counts);
}
run();
