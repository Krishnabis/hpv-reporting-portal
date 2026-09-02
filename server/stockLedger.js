import { supabase, useSupabase } from './db/database.js';
import fs from 'fs';

// Helper to determine the stock availability action
export function determineStockAction(stockAvailabilityPct) {
    if (stockAvailabilityPct < 10) return 'Replenish Now';
    if (stockAvailabilityPct >= 10 && stockAvailabilityPct < 25) return 'Re-order Stock';
    return 'No Action';
}

// Function to calculate and backfill monthly stock ledger
export async function ensureMonthlyLedger(upToMonthStr, blocks, districtStores, districtStoreMap, blockCcpMap, profilesMap, returnError = false) {
    if (!useSupabase) return null;

    const startMonth = '2026-01';
    
    // We will generate the list of months to check/calculate
    const months = [];
    let current = new Date(startMonth + '-01');
    const end = new Date(upToMonthStr + '-01');
    while (current <= end) {
        months.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
    }

    // Process month by month sequentially because month N depends on month N-1
    for (const monthStr of months) {
        // Fetch existing ledger records for this month
        const { data: existingLedger, error } = await supabase
            .from('vaccine_stock_ledger')
            .select('*')
            .eq('reporting_month', monthStr);

        if (error) {
            console.error('Error fetching ledger for month', monthStr, error);
            continue;
        }

        const existingMap = {};
        for (const record of (existingLedger || [])) {
            const key = record.entity_type === 'BLOCK' ? record.block_id : record.district_id;
            existingMap[key] = record;
        }

        const upserts = [];

        // Previous month's ledger to get opening stock
        let prevLedgerMap = {};
        if (monthStr !== startMonth) {
            const prevMonthDate = new Date(monthStr + '-01');
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);

            const { data: prevLedger } = await supabase
                .from('vaccine_stock_ledger')
                .select('*')
                .eq('reporting_month', prevMonthStr);
            
            for (const record of (prevLedger || [])) {
                const key = record.entity_type === 'BLOCK' ? record.block_id : record.district_id;
                prevLedgerMap[key] = record;
            }
        }

        // Fetch Transactions for current month (RECEIVED)
        const monthStart = monthStr + '-01';
        const nextMonthDate = new Date(monthStart);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        nextMonthDate.setDate(0);
        const monthEnd = nextMonthDate.toISOString().split('T')[0];
        const nextMonthStart = nextMonthDate.toISOString().slice(0, 7) + '-01';

        const { data: txs } = await supabase
            .from('vaccine_stock_transactions')
            .select('district_id, block_id, level, facility_id, quantity_doses, transaction_type, transaction_date')
            .gte('transaction_date', monthStart)
            .lte('transaction_date', monthEnd)
            .in('transaction_type', ['RECEIVED', 'ISSUED']);

        // Fetch daily reports for vaccinations (cumulative before month and in month)
        // We will fetch all daily reports up to this month to compute max
        const { data: dailyReports } = await supabase
            .from('daily_reports')
            .select('block_id, beneficiaries_vaccinated, reporting_date')
            .lte('reporting_date', monthEnd);

        // Fetch monthly balance for reported month-end stock
        const { data: monthEndBalances } = await supabase
            .from('monthly_balance')
            .select('facility_id, qty_doses')
            .eq('transaction_date', nextMonthStart); // Month-end stock is usually recorded on the 1st of next month
            
        const balanceMap = {};
        (monthEndBalances || []).forEach(b => { balanceMap[b.facility_id] = b.qty_doses; });

        // Process Blocks
        for (const block of blocks) {
            if (existingMap[block.id]) continue; 

            const profile = profilesMap[block.id] || { base_population: 0 };
            const annualReq = Math.round(((profile.base_population || 0) * 0.01) * 1.01);

            let preMonthReportingPct = 0;
            let preMonthEndStockReported = null;
            let openingStock = 0;
            let estimationModel = 'Crude Method';

            if (monthStr !== startMonth) {
                const prevRecord = prevLedgerMap[block.id];
                if (prevRecord) {
                    // preMonthReportingPct reflects the month before the previous month? No, the reporting pct of the previous month
                    // But reporting pct is calculated below. Let's assume 100% if we have a reported value.
                    if (prevRecord.reported_month_end_stock_current_month !== null && prevRecord.reported_month_end_stock_current_month !== undefined) {
                         openingStock = prevRecord.reported_month_end_stock_current_month;
                         estimationModel = 'Reported Value Method';
                         preMonthReportingPct = 100;
                         preMonthEndStockReported = prevRecord.reported_month_end_stock_current_month;
                    } else {
                         openingStock = prevRecord.closing_stock_estimated;
                         estimationModel = 'Crude Method';
                         preMonthReportingPct = 0; // Or calculate based on CCPs
                    }
                }
            }

            let received = 0;
            (txs || []).forEach(t => {
                if (t.block_id === block.id && t.level === '3' && t.transaction_type === 'RECEIVED') {
                    received += t.quantity_doses || 0;
                }
            });

            let latestBeforeMonth = 0;
            let latestInMonth = 0;
            (dailyReports || []).forEach(r => {
                if (r.block_id === block.id) {
                    if (r.reporting_date < monthStart && r.beneficiaries_vaccinated > latestBeforeMonth) {
                        latestBeforeMonth = r.beneficiaries_vaccinated;
                    }
                    if (r.reporting_date >= monthStart && r.reporting_date <= monthEnd && r.beneficiaries_vaccinated > latestInMonth) {
                        latestInMonth = r.beneficiaries_vaccinated;
                    }
                }
            });
            // If there were no reports in the month, latestInMonth might be 0, but vaccinations could be 0.
            const totalVaccinations = Math.max(0, (latestInMonth || latestBeforeMonth) - latestBeforeMonth);
            const vaccineConsumedWastage = Math.round(totalVaccinations * 1.01);

            const closingStock = Math.max(0, openingStock + received - vaccineConsumedWastage);
            const stockAvailability = annualReq > 0 ? (openingStock / annualReq) * 100 : 0;
            const action = determineStockAction(stockAvailability);

            // Determine if current month has 100% reporting
            const facs = blockCcpMap[block.id] || [];
            let reportedMonthEnd = 0;
            let reportingCount = 0;
            facs.forEach(f => {
                if (balanceMap[f] !== undefined) {
                    reportedMonthEnd += balanceMap[f];
                    reportingCount++;
                }
            });
            
            const currentReportingPct = facs.length > 0 ? (reportingCount / facs.length) * 100 : 0;
            const reportedMonthEndStockCurrent = currentReportingPct === 100 ? reportedMonthEnd : null;

            upserts.push({
                reporting_month: monthStr,
                district_id: block.district_id,
                block_id: block.id,
                entity_type: 'BLOCK',
                annual_requirement: annualReq,
                pre_month_reporting_percentage: preMonthReportingPct,
                pre_month_end_stock_reported: preMonthEndStockReported,
                opening_stock: openingStock,
                vaccine_received_current_month: received,
                vaccinations_current_month: totalVaccinations,
                vaccine_consumed_wastage_factor: vaccineConsumedWastage,
                closing_stock_estimated: closingStock,
                estimation_model: estimationModel,
                stock_availability_percentage: stockAvailability,
                action: action,
                reported_month_end_stock_current_month: reportedMonthEndStockCurrent
            });
        }

        // Process CCL Level-2 District Stores
        const processedDistrictStores = new Set();
        for (const ccl of districtStores) {
            if (processedDistrictStores.has(ccl.district_id)) continue;
            processedDistrictStores.add(ccl.district_id);

            const districtId = ccl.district_id;
            if (existingMap[districtId]) continue;

            const facs = districtStoreMap[districtId] || [];
            const annualReq = 0; // CCL2 typically doesn't have an annual requirement calculated this way, but we keep 0

            let preMonthReportingPct = 0;
            let preMonthEndStockReported = null;
            let openingStock = 0;
            let estimationModel = 'Crude Method';

            if (monthStr !== startMonth) {
                const prevRecord = prevLedgerMap[districtId];
                if (prevRecord) {
                    if (prevRecord.reported_month_end_stock_current_month !== null && prevRecord.reported_month_end_stock_current_month !== undefined) {
                         openingStock = prevRecord.reported_month_end_stock_current_month;
                         estimationModel = 'Reported Value Method';
                         preMonthReportingPct = 100;
                         preMonthEndStockReported = prevRecord.reported_month_end_stock_current_month;
                    } else {
                         openingStock = prevRecord.closing_stock_estimated;
                         estimationModel = 'Crude Method';
                    }
                }
            }

            let received = 0;
            let issued = 0;
            (txs || []).forEach(t => {
                if (t.district_id === districtId && t.level === '2' && facs.includes(t.facility_id)) {
                    if (t.transaction_type === 'RECEIVED') received += t.quantity_doses || 0;
                    else if (t.transaction_type === 'ISSUED') issued += t.quantity_doses || 0;
                }
            });

            const vaccineConsumedWastage = issued; // District stores do not vaccinate, so we log issued quantity here
            const closingStock = Math.max(0, openingStock + received - issued);
            const stockAvailability = 0;
            const action = '—';

            let reportedMonthEnd = 0;
            let reportingCount = 0;
            facs.forEach(f => {
                if (balanceMap[f] !== undefined) {
                    reportedMonthEnd += balanceMap[f];
                    reportingCount++;
                }
            });
            
            const currentReportingPct = facs.length > 0 ? (reportingCount / facs.length) * 100 : 0;
            const reportedMonthEndStockCurrent = currentReportingPct === 100 ? reportedMonthEnd : null;

            upserts.push({
                reporting_month: monthStr,
                district_id: districtId,
                block_id: null,
                ccl_id: ccl.id,
                entity_type: 'CCL_LEVEL_2_DISTRICT_STORE',
                annual_requirement: annualReq,
                pre_month_reporting_percentage: preMonthReportingPct,
                pre_month_end_stock_reported: preMonthEndStockReported,
                opening_stock: openingStock,
                vaccine_received_current_month: received,
                vaccinations_current_month: 0,
                vaccine_consumed_wastage_factor: vaccineConsumedWastage,
                closing_stock_estimated: closingStock,
                estimation_model: estimationModel,
                stock_availability_percentage: stockAvailability,
                action: action,
                reported_month_end_stock_current_month: reportedMonthEndStockCurrent
            });
        }

        if (upserts.length > 0) {
            const { error: upsertErr } = await supabase.from('vaccine_stock_ledger').insert(upserts);
            if (upsertErr) {
                console.error('Error inserting ledger for month', monthStr, upsertErr);
                fs.writeFileSync('db_error.log', JSON.stringify(upsertErr, null, 2));
                if (returnError) return { error: upsertErr };
            }
        }
    }
}
