import { supabase } from './server/db/database.js';
async function run() {
  const { data } = await supabase.from('vaccine_stock_ledger').select('*').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
run();
