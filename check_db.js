import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: blocks } = await supabase.from('blocks').select('*').ilike('name', '%Chamba%');
  console.log("Blocks:", blocks.map(b => ({id: b.id, lgd_code: b.lgd_code})));
  
  if (blocks.length > 0) {
    const lgd = blocks[0].lgd_code;
    const { data: ccps } = await supabase.from('vaccine_ccp').select('id, facility_name, block_id, lgd_block_code').eq('lgd_block_code', lgd);
    console.log("CCPs by LGD:", ccps.length);
    
    const { data: ccpsByBlockId } = await supabase.from('vaccine_ccp').select('id, facility_name, block_id, lgd_block_code').eq('block_id', blocks[0].id);
    console.log("CCPs by Block ID:", ccpsByBlockId.length);
  }
}
check();
