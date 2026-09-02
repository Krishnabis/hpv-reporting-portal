import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('vaccine_stock_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(20);
  console.log(JSON.stringify(data, null, 2));
}
run();
