const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove ledger query from api/vaccine/dashboard
const originalDashboardLedger = `    // Fetch latest stock ledger to get accurate current stock balances for blocks
    const { data: rawLedgers, error: lErr } = await supabase.from('vaccine_stock_ledger').select('block_id, entity_type, closing_stock_estimated, reporting_month').order('reporting_month', { ascending: false });
    if (lErr) throw lErr;
    const latestLedgers = {};
    (rawLedgers || []).forEach(r => {
      const key = r.entity_type === 'BLOCK' ? \`block_\${r.block_id}\` : \`district_\${r.district_id}\`;
      if (!latestLedgers[key]) latestLedgers[key] = r;
    });`;

const newDashboardLedger = `    // Fetch latest stock ledger to get accurate current stock balances for blocks
    // vaccine_stock_ledger has been deleted.
    const latestLedgers = {};`;

content = content.replace(originalDashboardLedger, newDashboardLedger);

// 2. Remove ledger query from api/admin/reports/stock-monitoring
const originalMonitoringLedger = `    // Fetch existing ledger records if available
    let ledgerRecords = null;
    if (finalDistrictIds.length > 0 && !reset) {
        try {
            const { data: records } = await supabase
                .from('vaccine_stock_ledger')
                .select('*')
                .eq('reporting_month', targetMonthStr)
                .in('district_id', finalDistrictIds);
            if (records && records.length > 0) {
                ledgerRecords = records;
            }
        } catch (e) {
            console.warn('Could not read vaccine_stock_ledger:', e);
        }
    }`;

const newMonitoringLedger = `    // Fetch existing ledger records if available
    // vaccine_stock_ledger has been removed
    let ledgerRecords = null;`;

content = content.replace(originalMonitoringLedger, newMonitoringLedger);

fs.writeFileSync(file, content);
console.log('Fixed vaccine_stock_ledger references successfully');
