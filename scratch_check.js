import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data, error } = await supabase.from('vaccine_stock_transactions').select('*').limit(1);
  if (error) console.log(error);
  else console.log(Object.keys(data[0] || {}));
}
run();
