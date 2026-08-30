import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '/Users/nitin/Downloads/HPV TRACKER/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: issue } = await supabase.from('stock_issue').select('*').order('created_at', {ascending: false}).limit(3);
  const { data: recv } = await supabase.from('stock_receive').select('*').order('created_at', {ascending: false}).limit(3);
  const { data: bat } = await supabase.from('vaccine_batches').select('*').order('updated_at', {ascending: false}).limit(3);
  
  console.log("RECENT ISSUES:");
  console.dir(issue, {depth: null});
  console.log("RECENT RECEIPTS:");
  console.dir(recv, {depth: null});
  console.log("RECENT BATCHES:");
  console.dir(bat, {depth: null});
}

check();
