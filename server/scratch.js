require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
async function run() {
  const { data: dr } = await supabase.from('daily_reports').select('*').limit(1);
  const { data: mdr } = await supabase.from('monthly_due_list_reports').select('*').limit(1);
  const { data: mb } = await supabase.from('monthly_balance').select('*').limit(1);
  console.log("daily_reports:", dr && dr.length ? Object.keys(dr[0]) : "empty");
  console.log("monthly_due_list_reports:", mdr && mdr.length ? Object.keys(mdr[0]) : "empty");
  console.log("monthly_balance:", mb && mb.length ? Object.keys(mb[0]) : "empty");
}
run();
