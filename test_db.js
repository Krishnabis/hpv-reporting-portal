import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: ccp } = await supabase.from('vaccine_ccp').select('unit_level');
  console.log('CCP count:', ccp?.length);
  const { data: tx1 } = await supabase.from('stock_receive').select('id');
  console.log('Recv count:', tx1?.length);
}
run();
