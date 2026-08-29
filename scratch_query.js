import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/nitin/Downloads/HPV TRACKER/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: ccps } = await supabase.from('vaccine_ccp').select('*').eq('lgd_block_code', 426);
  console.log('CCPs with lgd 426:', ccps?.length || 0);
  
  const { data: ccps2 } = await supabase.from('vaccine_ccp').select('*').eq('block_id', 292);
  console.log('CCPs with block_id 292:', ccps2?.length || 0);

  const { data: all } = await supabase.from('vaccine_ccp').select('facility_name, lgd_block_code, block_id').ilike('facility_name', '%Chamba%');
  console.log('Any Chamba facilities?', all);
}
check();
