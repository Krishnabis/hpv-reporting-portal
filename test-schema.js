import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY);
async function run() {
  const { data, error } = await supabase.from('vaccine_ccp').select('id').limit(1);
  console.log('vaccine_ccp:', typeof data[0]?.id, data);
}
run();
