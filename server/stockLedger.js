import { supabase } from './db/database.js';

export async function ensureMonthlyLedger(targetMonthStr, blocks, districtStores, districtStoreMap, blockCcpMap, profileMap, debug = false) {
    if (!supabase) return { error: 'No database connection' };
    
    try {
        const targetMonthDate = new Date(targetMonthStr + '-01');
        
        const prevMonthDate = new Date(targetMonthDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toISOString().split('T')[0].slice(0, 7);
        
        const twelveMonthsPriorDate = new Date(prevMonthDate);
        twelveMonthsPriorDate.setMonth(twelveMonthsPriorDate.getMonth() - 11); // To include exactly 12 months ending at prevMonthStr
        const twelveMonthsPriorStr = twelveMonthsPriorDate.toISOString().split('T')[0].slice(0, 7);
        
        const thirteenMonthsPriorDate = new Date(twelveMonthsPriorDate);
        thirteenMonthsPriorDate.setMonth(thirteenMonthsPriorDate.getMonth() - 1);
        const thirteenMonthsPriorStr = thirteenMonthsPriorDate.toISOString().split('T')[0].slice(0, 7);

        // Date boundaries
        const targetMonthStart = targetMonthStr + '-01';
        const nextMonthDate = new Date(targetMonthDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const targetMonthEnd = new Date(nextMonthDate - 1).toISOString().split('T')[0];
        
        const twelveMonthsPriorStart = twelveMonthsPriorStr + '-01';
        const prevMonthEnd = new Date(targetMonthDate - 1).toISOString().split('T')[0];
        
        const thirteenMonthsPriorEnd = new Date(twelveMonthsPriorDate - 1).toISOString().split('T')[0];

        // Fetch data
        const [
            { data: monthlyBalances },
            { data: transactionsLast12 },
            { data: transactionsCurrent },
            { data: dailyReports }
        ] = await Promise.all([
            // 1. Monthly balances for the PREVIOUS month to determine reporting %
            supabase.from('monthly_balance').select('facility_id, qty_doses, transaction_date').gte('transaction_date', prevMonthStr + '-01').lte('transaction_date', prevMonthEnd),
            // 2. Transactions for the LAST 12 MONTHS (up to prevMonthEnd)
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses').gte('transaction_date', twelveMonthsPriorStart).lte('transaction_date', prevMonthEnd).eq('transaction_type', 'RECEIVED'),
            // 3. Transactions for CURRENT MONTH
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses').gte('transaction_date', targetMonthStart).lte('transaction_date', targetMonthEnd),
            // 4. Daily reports (we need all history up to targetMonthEnd to compute max)
            supabase.from('daily_reports').select('block_id, reporting_date, beneficiaries_vaccinated').lte('reporting_date', targetMonthEnd)
        ]);

        // Process Daily Reports into Max Cumulative logic
        const maxVaxThirteenMonths = {};
        const maxVaxPrevMonth = {};
        const maxVaxCurrentMonth = {};

        (dailyReports || []).forEach(r => {
            const b = r.block_id;
            if (!maxVaxThirteenMonths[b]) maxVaxThirteenMonths[b] = 0;
            if (!maxVaxPrevMonth[b]) maxVaxPrevMonth[b] = 0;
            if (!maxVaxCurrentMonth[b]) maxVaxCurrentMonth[b] = 0;

            if (r.reporting_date <= thirteenMonthsPriorEnd && r.beneficiaries_vaccinated > maxVaxThirteenMonths[b]) {
                maxVaxThirteenMonths[b] = r.beneficiaries_vaccinated;
            }
            if (r.reporting_date <= prevMonthEnd && r.beneficiaries_vaccinated > maxVaxPrevMonth[b]) {
                maxVaxPrevMonth[b] = r.beneficiaries_vaccinated;
            }
            if (r.reporting_date <= targetMonthEnd && r.beneficiaries_vaccinated > maxVaxCurrentMonth[b]) {
                maxVaxCurrentMonth[b] = r.beneficiaries_vaccinated;
            }
        });

        // Delete existing ledger for the target month
        await supabase.from('vaccine_stock_ledger').delete().eq('reporting_month', targetMonthStr);

        const upserts = [];

        // ─── PROCESS BLOCKS ───────────────────────────────────────────────
        for (const block of blocks) {
            const prof = profileMap[block.id];
            const annualReq = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);

            // Pre. Month-end Reporting %
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

            // Vaccinations
            const vaxLast12Months = Math.max(0, (maxVaxPrevMonth[block.id] || 0) - (maxVaxThirteenMonths[block.id] || 0));
            const vaxCurrentMonth = Math.max(0, (maxVaxCurrentMonth[block.id] || 0) - (maxVaxPrevMonth[block.id] || 0));

            // Received
            let receivedLast12Months = 0;
            (transactionsLast12 || []).forEach(t => {
                if (t.block_id === block.id && t.transaction_type === 'RECEIVED') {
                    receivedLast12Months += t.quantity_doses;
                }
            });

            let receivedCurrentMonth = 0;
            (transactionsCurrent || []).forEach(t => {
                if (t.block_id === block.id && t.transaction_type === 'RECEIVED') {
                    receivedCurrentMonth += t.quantity_doses;
                }
            });

            const vaccineConsumedWastageFactor12M = Math.round(vaxLast12Months * 1.01);
            const openingStockCrudeMethod = Math.max(0, receivedLast12Months - vaccineConsumedWastageFactor12M);

            const estimationModel = preMonthReportingPct === 100 ? 'Reported Value Method' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Value Method' ? preMonthEndStockReported : openingStockCrudeMethod;

            const vaccineConsumedCurrentMonth = Math.round(vaxCurrentMonth * 1.01);
            const closingStockEstimated = Math.max(0, openingStock + receivedCurrentMonth - vaccineConsumedCurrentMonth);

            const stockAvailabilityPercentage = annualReq > 0 ? (openingStock / annualReq) * 100 : 0;
            
            let action = '—';
            if (stockAvailabilityPercentage > 0) {
                if (stockAvailabilityPercentage < 10) action = 'Critical';
                else if (stockAvailabilityPercentage < 25) action = 'Re-order Stock';
            }

            upserts.push({
                reporting_month: targetMonthStr,
                district_id: block.district_id,
                block_id: block.id,
                entity_type: 'BLOCK',
                annual_requirement: annualReq,
                pre_month_reporting_percentage: preMonthReportingPct,
                pre_month_reporting_count: preMonthReportingCount,
                pre_month_total_ccp: preMonthTotalCcp,
                pre_month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                opening_stock: openingStock,
                vaccine_received_current_month: receivedCurrentMonth,
                vaccinations_current_month: vaxCurrentMonth,
                vaccine_consumed_wastage_factor: vaccineConsumedCurrentMonth,
                closing_stock_estimated: closingStockEstimated,
                estimation_model: estimationModel,
                stock_availability_percentage: stockAvailabilityPercentage,
                action: action,
                vaccine_received_last_12_months: receivedLast12Months,
                vaccinations_last_12_months: vaxLast12Months
            });
        }

        // ─── PROCESS DISTRICT STORES ───────────────────────────────────────
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

            let receivedLast12Months = 0;
            (transactionsLast12 || []).forEach(t => {
                if (t.district_id === districtId && String(t.level) === '2' && t.transaction_type === 'RECEIVED' && facs.includes(t.facility_id)) {
                    receivedLast12Months += t.quantity_doses;
                }
            });

            let issuedLast12Months = 0;
            const { data: issuedLast12Data } = await supabase.from('vaccine_stock_transactions').select('quantity_doses').gte('transaction_date', twelveMonthsPriorStart).lte('transaction_date', prevMonthEnd).eq('transaction_type', 'ISSUED').eq('district_id', districtId).eq('level', '2').in('facility_id', facs);
            (issuedLast12Data || []).forEach(t => { issuedLast12Months += t.quantity_doses; });
            
            const openingStockCrudeMethod = Math.max(0, receivedLast12Months - issuedLast12Months);

            const estimationModel = preMonthReportingPct === 100 ? 'Reported Value Method' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Value Method' ? preMonthEndStockReported : openingStockCrudeMethod;

            let receivedCurrentMonth = 0;
            let issuedCurrentMonth = 0;
            (transactionsCurrent || []).forEach(t => {
                if (t.district_id === districtId && String(t.level) === '2' && facs.includes(t.facility_id)) {
                    if (t.transaction_type === 'RECEIVED') receivedCurrentMonth += t.quantity_doses;
                    if (t.transaction_type === 'ISSUED') issuedCurrentMonth += t.quantity_doses;
                }
            });

            const closingStockEstimated = Math.max(0, openingStock + receivedCurrentMonth - issuedCurrentMonth);

            upserts.push({
                reporting_month: targetMonthStr,
                district_id: districtId,
                block_id: null,
                ccl_id: ccl.id,
                entity_type: 'CCL_LEVEL_2_DISTRICT_STORE',
                annual_requirement: 0,
                pre_month_reporting_percentage: preMonthReportingPct,
                pre_month_reporting_count: preMonthReportingCount,
                pre_month_total_ccp: preMonthTotalCcp,
                pre_month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                opening_stock: openingStock,
                vaccine_received_current_month: receivedCurrentMonth,
                vaccinations_current_month: 0,
                vaccine_consumed_wastage_factor: issuedCurrentMonth,
                closing_stock_estimated: closingStockEstimated,
                estimation_model: estimationModel,
                stock_availability_percentage: 0,
                action: '—',
                vaccine_received_last_12_months: receivedLast12Months,
                vaccinations_last_12_months: issuedLast12Months
            });
        }

        const chunkSize = 100;
        for (let i = 0; i < upserts.length; i += chunkSize) {
            const chunk = upserts.slice(i, i + chunkSize);
            const { error: insErr } = await supabase.from('vaccine_stock_ledger').insert(chunk);
            if (insErr) {
                console.error('Error inserting stock ledger chunk:', insErr);
                return { error: insErr.message };
            }
        }
        
        return { success: true };

    } catch (err) {
        console.error('Error in ensureMonthlyLedger:', err);
        return { error: err.message };
    }
}
