import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const blockId = 292;
  const { data: block } = await supabase.from('blocks').select('lgd_code').eq('id', blockId).maybeSingle();
  console.log("Block LGD Code:", block?.lgd_code);
  
  const lgdCode = block?.lgd_code;
  
  if (lgdCode) {
    const { data: ccpsLgd } = await supabase.from('vaccine_ccp').select('id, facility_name, block_id, lgd_block_code').eq('lgd_block_code', lgdCode);
    console.log("CCPs with matching LGD Code:", ccpsLgd?.length);
    
    const { data: ccpsBlockId } = await supabase.from('vaccine_ccp').select('id, facility_name, block_id, lgd_block_code').eq('block_id', blockId);
    console.log("CCPs with matching Block ID:", ccpsBlockId?.length);
  }
}
test();
