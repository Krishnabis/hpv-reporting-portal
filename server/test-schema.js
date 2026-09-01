const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data: d1 } = await supabase.from('daily_reports').select('*').limit(1);
  const { data: d2 } = await supabase.from('monthly_due_list_reports').select('*').limit(1);
  const { data: d3 } = await supabase.from('monthly_balance').select('*').limit(1);
  console.log("daily_reports:", d1 && d1.length ? Object.keys(d1[0]) : "empty");
  console.log("monthly_due_list_reports:", d2 && d2.length ? Object.keys(d2[0]) : "empty");
  console.log("monthly_balance:", d3 && d3.length ? Object.keys(d3[0]) : "empty");
}
run();
