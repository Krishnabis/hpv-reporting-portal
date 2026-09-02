import { supabase } from './server/db/database.js';
import { ensureMonthlyLedger } from './server/stockLedger.js';
async function test() {
  try {
    const blocks = [{ id: 1, district_id: 1 }];
    const districtStores = [{ id: 100, district_id: 1 }];
    const districtStoreMap = { 1: [100] };
    const blockCcpMap = { 1: [200] };
    const profilesMap = { 1: { base_population: 1000 } };
    await ensureMonthlyLedger('2026-09', blocks, districtStores, districtStoreMap, blockCcpMap, profilesMap);
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
