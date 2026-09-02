import dotenv from 'dotenv';
dotenv.config();
import { ensureMonthlyLedger } from './server/stockLedger.js';
import { supabase } from './server/db/database.js';

async function run() {
    let bQuery = supabase
      .from('blocks')
      .select(`
        id, name, health_block_name, is_urban, lgd_code, district_id, hpv_target, population,
        districts!inner(id, name, lgd_code, state_id, division_id, divisions(name))
      `)
      .eq('is_active', true)
      .order('name');
      
    const { data: blocks } = await bQuery;
    
    const blockIds = blocks.map(b => b.id);
    const finalDistrictIds = [...new Set(blocks.map(b => b.district_id))];

    const { data: profiles } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population, initial_hpv_target')
      .in('block_id', blockIds);
      
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    const { data: allCcps } = await supabase
      .from('vaccine_ccp')
      .select('id, unit_level, district_id, block_id')
      .in('unit_level', ['2', '3'])
      .in('district_id', finalDistrictIds);
      
    const districtStores = allCcps.filter(c => c.unit_level === '2');
    const blockCcps = allCcps.filter(c => c.unit_level === '3');
    
    const districtStoreMap = {}; 
    districtStores.forEach(c => {
      if (!districtStoreMap[c.district_id]) districtStoreMap[c.district_id] = [];
      districtStoreMap[c.district_id].push(c.id);
    });

    const blockCcpMap = {}; 
    blockCcps.forEach(c => {
      if (!blockCcpMap[c.block_id]) blockCcpMap[c.block_id] = [];
      blockCcpMap[c.block_id].push(c.id);
    });
    
    console.log(`Blocks: ${blocks.length}, CCps: ${allCcps.length}`);
    const res = await ensureMonthlyLedger('2026-09', blocks, districtStores, districtStoreMap, blockCcpMap, profileMap, true);
    console.log(res);
}

run();
