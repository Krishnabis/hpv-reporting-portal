const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: ccp } = await supabase.from('vaccine_ccp').select('*').in('unit_level', ['2']);
  console.log('Level 2 CCPs:', ccp.length);
  
  const distIds = ccp.map(c => c.district_id);
  
  const { data: txs } = await supabase.from('vaccine_stock_transactions').select('*').in('district_id', distIds);
  console.log('Txs for these districts:', txs.length);
  console.log('Txs without block_id:', txs.filter(t => !t.block_id).length);
  
  const { data: balances } = await supabase.from('monthly_balance').select('*');
  console.log('Monthly balances total:', balances.length);
}
run();
