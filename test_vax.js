import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data } = await supabase.from('vaccine_stock_ledger').select('entity_type, vaccinations_current_month, reporting_month, block_id, district_id');
  let blockSum = 0;
  data.forEach(d => { if (d.entity_type === 'BLOCK') blockSum += (d.vaccinations_current_month || 0); });
  console.log("Total block vaccinations in ledger:", blockSum);
  console.log("Sample records:", data.slice(0, 5));
}
run();
