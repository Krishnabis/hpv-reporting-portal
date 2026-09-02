import { supabase } from './server/db/database.js';
async function run() {
  const { data } = await supabase.from('vaccine_stock_transactions').select('level, transaction_type').limit(100);
  const types = new Set(data.map(d => `${d.level}-${d.transaction_type}`));
  console.log([...types]);
}
run();
