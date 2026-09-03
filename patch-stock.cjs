const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add ccl_id to allCcps query
content = content.replace(
  ".select('id, unit_level, district_id, block_id')",
  ".select('id, ccl_id, unit_level, district_id, block_id')"
);

// 2. Add ccpCclIdMap
content = content.replace(
  "const districtStoreMap = {};",
  "const ccpCclIdMap = {};\n    allCcps.forEach(c => { if(c.ccl_id) ccpCclIdMap[c.id] = c.ccl_id; });\n    const districtStoreMap = {};"
);

// 3. Replace the fallback block
const startStr = "const [\n            { data: monthlyBalances },";
const endStr = "// Asynchronously update ledger table without blocking response";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find start or end index");
    process.exit(1);
}

const replacement = `const [
            { data: monthlyBalances },
            { data: transactionsHistorical },
            { data: transactionsCurrent },
            { data: dailyReports }
        ] = await Promise.all([
            supabase.from('monthly_balance').select('facility_id, qty_doses, transaction_date').gte('transaction_date', prevMonthStr + '-01').lte('transaction_date', prevMonthEnd).limit(50000),
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses, source_ccl_id, destination_ccl_id').lte('transaction_date', prevMonthEnd).limit(100000),
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses, source_ccl_id, destination_ccl_id').gte('transaction_date', targetMonthStart).lte('transaction_date', targetMonthEnd).limit(50000),
            supabase.from('daily_reports').select('block_id, reporting_date, beneficiaries_vaccinated').lte('reporting_date', targetMonthEnd).order('reporting_date', { ascending: false }).limit(50000)
        ]);

        const maxVaxPrevMonth = {};
        const maxVaxCurrentMonth = {};

        (dailyReports || []).forEach(r => {
            const b = r.block_id;
            if (r.reporting_date <= prevMonthEnd && maxVaxPrevMonth[b] === undefined) {
                maxVaxPrevMonth[b] = r.beneficiaries_vaccinated || 0;
            }
            if (r.reporting_date <= targetMonthEnd && maxVaxCurrentMonth[b] === undefined) {
                maxVaxCurrentMonth[b] = r.beneficiaries_vaccinated || 0;
            }
        });

        // Helper for transaction grouping
        const calculateFlows = (facs, txList) => {
            let inflow = 0;
            let outflow = 0;
            const facCclIds = facs.map(f => ccpCclIdMap[f]).filter(Boolean);
            
            (txList || []).forEach(t => {
                const qty = Number(t.quantity_doses || 0);
                if (t.transaction_type === 'RECEIVED') {
                    if (facs.includes(t.facility_id) && !t.source_ccl_id) inflow += qty;
                } else if (t.transaction_type === 'ISSUED') {
                    if (t.destination_ccl_id && facCclIds.includes(t.destination_ccl_id) && !facs.includes(t.facility_id)) {
                        inflow += qty;
                    }
                    if (facs.includes(t.facility_id) && (!t.destination_ccl_id || !facCclIds.includes(t.destination_ccl_id))) {
                        outflow += qty;
                    }
                }
            });
            return { inflow, outflow };
        };

        // 1. Process Blocks
        blocks.forEach(block => {
            const prof = profileMap[block.id];
            const baseTarget = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : (block.population ? Math.round(block.population * 0.01) : 0));
            const annualReq = Math.round(baseTarget * 1.01);
            const facs = blockCcpMap[block.id] || [];

            let preMonthReportingCount = 0;
            let preMonthEndStockReported = 0;
            facs.forEach(f => {
                const bal = (monthlyBalances || []).find(x => String(x.facility_id) === String(f));
                if (bal) {
                    preMonthReportingCount++;
                    preMonthEndStockReported += bal.qty_doses;
                }
            });

            const preMonthTotalCcp = facs.length;
            const preMonthReportingPct = preMonthTotalCcp > 0 ? (preMonthReportingCount / preMonthTotalCcp) * 100 : 0;

            const vaxHistorical = maxVaxPrevMonth[block.id] || 0;
            const vaxCurrentMonth = Math.max(0, (maxVaxCurrentMonth[block.id] || 0) - vaxHistorical);

            const histFlows = calculateFlows(facs, transactionsHistorical);
            const currFlows = calculateFlows(facs, transactionsCurrent);

            // True opening stock using crude method is historical inflow - historical outflow - historical vaccinations
            const openingStockCrudeMethod = Math.max(0, histFlows.inflow - histFlows.outflow - vaxHistorical);
            const estimationModel = preMonthReportingPct === 100 ? 'Reported Stock' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Stock' ? preMonthEndStockReported : openingStockCrudeMethod;

            const closingStockEstimated = Math.max(0, openingStock + currFlows.inflow - currFlows.outflow - vaxCurrentMonth);
            const stockAvailabilityPercentage = annualReq > 0 ? Math.round((closingStockEstimated / annualReq) * 100) : 0;
            
            let action = '—';
            if (annualReq > 0) {
                if (stockAvailabilityPercentage < 10) action = 'Critical';
                else if (stockAvailabilityPercentage < 25) action = 'Replenish';
                else if (stockAvailabilityPercentage < 50) action = 'Monitor';
                else action = 'Adequate';
            }

            blockData.push({
                id: block.id,
                name: block.health_block_name || block.name,
                is_urban: block.is_urban,
                population: block.population || 0,
                district: block.districts?.name,
                district_id: block.district_id,
                division_id: block.districts?.division_id,
                division_name: block.districts?.divisions?.name,
                annual_requirement: annualReq,
                opening_stock: openingStock,
                vaccine_received: currFlows.inflow,
                vaccinations: vaxCurrentMonth,
                estimated_stock_balance: closingStockEstimated,
                month_end_reporting_pct: preMonthReportingPct,
                month_end_reporting_count: preMonthReportingCount,
                month_end_total_ccp: preMonthTotalCcp,
                month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                estimation_model: estimationModel,
                stock_availability_pct: stockAvailabilityPercentage,
                action_required: action,
                vaccine_received_last_12_months: histFlows.inflow,
                vaccinations_last_12_months: vaxHistorical,
                entity_type: 'BLOCK'
            });
        });

        // 2. Process District Stores
        const processedDistrictStores = new Set();
        for (const ccl of districtStores) {
            if (processedDistrictStores.has(ccl.district_id)) continue;
            processedDistrictStores.add(ccl.district_id);

            const districtId = ccl.district_id;
            const facs = districtStoreMap[districtId] || [];

            let preMonthReportingCount = 0;
            let preMonthEndStockReported = 0;

            facs.forEach(f => {
                const bal = (monthlyBalances || []).find(x => String(x.facility_id) === String(f));
                if (bal) {
                    preMonthReportingCount++;
                    preMonthEndStockReported += bal.qty_doses;
                }
            });

            const preMonthTotalCcp = facs.length;
            const preMonthReportingPct = preMonthTotalCcp > 0 ? (preMonthReportingCount / preMonthTotalCcp) * 100 : 0;

            let districtTotalVaxHistorical = 0;
            let districtTotalVaxCurrent = 0;
            blocks.forEach(b => {
                if (b && String(b.district_id) === String(districtId)) {
                    const hist = maxVaxPrevMonth[b.id] || 0;
                    districtTotalVaxHistorical += hist;
                    districtTotalVaxCurrent += Math.max(0, (maxVaxCurrentMonth[b.id] || 0) - hist);
                }
            });

            const histFlows = calculateFlows(facs, transactionsHistorical);
            const currFlows = calculateFlows(facs, transactionsCurrent);

            // District store vaccinations are technically its issues, but if we track crude method:
            // Since vaccinations happen at blocks, the district store outflow is effectively its issues to blocks.
            // Opening crude = histFlows.inflow - histFlows.outflow. (District stores don't directly vaccinate)
            const openingStockCrudeMethod = Math.max(0, histFlows.inflow - histFlows.outflow);

            const estimationModel = preMonthReportingPct === 100 ? 'Reported Stock' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Stock' ? preMonthEndStockReported : openingStockCrudeMethod;

            const closingStockEstimated = Math.max(0, openingStock + currFlows.inflow - currFlows.outflow);
            const d = blocks.find(x => x.district_id === districtId)?.districts;

            districtStoreData.push({
                id: districtId + '-ccl2',
                name: (d?.name || '') + ' District Store',
                population: 0,
                is_urban: false,
                district: d?.name || '',
                district_id: districtId,
                division_id: d?.division_id,
                division_name: d?.divisions?.name,
                annual_requirement: 0,
                opening_stock: openingStock,
                vaccine_received: currFlows.inflow,
                vaccinations: currFlows.outflow, 
                estimated_stock_balance: closingStockEstimated,
                month_end_reporting_pct: preMonthReportingPct,
                month_end_reporting_count: preMonthReportingCount,
                month_end_total_ccp: preMonthTotalCcp,
                month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                estimation_model: estimationModel,
                stock_availability_pct: 0,
                action_required: '—',
                vaccine_received_last_12_months: histFlows.inflow,
                vaccinations_last_12_months: districtTotalVaxHistorical,
                entity_type: 'CCL_LEVEL_2_DISTRICT_STORE'
            });
        }

        `;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync(file, content);
console.log('Patched successfully');
