import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'vaccine_ccp' });
  if (error) {
     // fallback if rpc not available
     const { data: cols } = await supabase.from('vaccine_ccp').select('*').limit(1);
     console.log(Object.keys(cols[0] || {}));
  } else {
     console.log(data);
  }
}
checkSchema();
