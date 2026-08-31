import re

with open('server/index.js', 'r') as f:
    content = f.read()

# 1. Replace updateBatchInventory with getBatchInventory
old_helper = r"""// Helper to update batch inventory in vaccine_batches
async function updateBatchInventory\(batch_no, manufacture_name, batch_expiry_date, level, state_id, district_id, block_id, facility_id, qty_change, vaccinated_change\) \{
  if \(!batch_no \|\| !level\) return;
  let query = supabase.from\('vaccine_batches'\).select\('\*'\).eq\('batch_no', batch_no\).eq\('level', level\);
  if \(state_id\) query = query.eq\('state_id', state_id\);
  if \(district_id\) query = query.eq\('district_id', district_id\);
  if \(block_id\) query = query.eq\('block_id', block_id\);
  if \(facility_id\) query = query.eq\('facility_id', facility_id\);
  
  const \{ data: existing \} = await query.limit\(1\);
  if \(existing && existing.length > 0\) \{
    const row = existing\[0\];
    const newQty = Number\(row.quantity\) \+ Number\(qty_change \|\| 0\);
    const newVaccQty = Number\(row.vaccinated_qty\) \+ Number\(vaccinated_change \|\| 0\);
    let updatePayload = \{ quantity: newQty, vaccinated_qty: newVaccQty, updated_at: new Date\(\).toISOString\(\) \};
    if \(manufacture_name\) updatePayload.manufacture_name = manufacture_name;
    if \(batch_expiry_date\) updatePayload.batch_expiry_date = batch_expiry_date;
    await supabase.from\('vaccine_batches'\).update\(updatePayload\).eq\('id', row.id\);
  \} else \{
    await supabase.from\('vaccine_batches'\).insert\(\[\{
      batch_no,
      manufacture_name: manufacture_name \|\| null,
      batch_expiry_date: batch_expiry_date \|\| null,
      level,
      state_id: state_id \|\| null,
      district_id: district_id \|\| null,
      block_id: block_id \|\| null,
      facility_id: facility_id \|\| null,
      quantity: Number\(qty_change \|\| 0\),
      vaccinated_qty: Number\(vaccinated_change \|\| 0\)
    \}\]\);
  \}
\}"""

new_helper = """// Helper to get batch inventory from vaccine_stock_transactions
async function getBatchInventory(batch_no, level, state_id, district_id, facility_id) {
  if (!batch_no || !level) return 0;
  
  // To get the balance, we sum RECEIVED and subtract ISSUED for this batch at this level
  let query = supabase.from('vaccine_stock_transactions').select('quantity_doses, transaction_type').eq('batch_no', batch_no).eq('level', String(level));
  if (state_id) query = query.eq('state_id', state_id);
  if (district_id) query = query.eq('district_id', district_id);
  if (facility_id) query = query.eq('facility_id', facility_id);
  
  const { data } = await query;
  if (!data) return 0;
  
  let balance = 0;
  for (const tx of data) {
    if (tx.transaction_type === 'RECEIVED') balance += Number(tx.quantity_doses || 0);
    else if (tx.transaction_type === 'ISSUED') balance -= Number(tx.quantity_doses || 0);
  }
  
  // We also need to subtract vaccinations done from this batch (if tracked) or block-level vaccinations.
  // Currently block vaccinations don't track batch_no, so this mostly applies to stock movement.
  return balance;
}"""

content = re.sub(old_helper, new_helper, content)


# 2. Update /api/vaccine/dashboard to query vaccine_stock_transactions instead of stock_receive/stock_issue/monthly_balance
old_dashboard = r"""    // 2\. Fetch stock transactions
    let recvQuery = supabase.from\('stock_receive'\).select\('\*'\);
    let issueQuery = supabase.from\('stock_issue'\).select\('\*'\);
    let balQuery = supabase.from\('monthly_balance'\).select\('\*'\);

    if \(targetStateId\) \{
       recvQuery = recvQuery.eq\('state_id', targetStateId\);
       issueQuery = issueQuery.eq\('state_id', targetStateId\);
       balQuery = balQuery.eq\('state_id', targetStateId\);
    \}
    const \[ \{data: recv\}, \{data: issue\}, \{data: bal\} \] = await Promise.all\(\[recvQuery, issueQuery, balQuery\]\);

    const tx = \[
      \.\.\.\(recv \|\| \[\]\).map\(t => \(\{...t, transaction_type: 'RECEIVED', level: t.destination_level, quantity_doses: t.qty_doses\}\)\),
      \.\.\.\(issue \|\| \[\]\).map\(t => \(\{...t, transaction_type: 'ISSUED', level: t.source_level, quantity_doses: t.qty_doses\}\)\),
      \.\.\.\(bal \|\| \[\]\).map\(t => \(\{...t, transaction_type: 'MONTH_END_BALANCE', level: t.block_id \? '3' : \(t.district_id \? '2' : '1'\), quantity_doses: t.qty_doses, balance_month: t.transaction_date\}\)\)
    \];"""

new_dashboard = """    // 2. Fetch stock transactions
    let txQuery = supabase.from('vaccine_stock_transactions').select('*');
    let balQuery = supabase.from('monthly_balance').select('*');

    if (targetStateId) {
       txQuery = txQuery.eq('state_id', targetStateId);
       balQuery = balQuery.eq('state_id', targetStateId);
    }
    const [ {data: stockTx}, {data: bal} ] = await Promise.all([txQuery, balQuery]);

    const tx = [
      ...(stockTx || []).map(t => ({...t})),
      ...(bal || []).map(t => ({...t, transaction_type: 'MONTH_END_BALANCE', level: t.block_id ? '3' : (t.district_id ? '2' : '1'), quantity_doses: t.qty_doses, balance_month: t.transaction_date}))
    ];"""

content = re.sub(old_dashboard, new_dashboard, content)


# 3. Update /api/vaccine/stock/receive to insert into vaccine_stock_transactions
old_receive = r"""    const \{ data, error \} = await supabase.from\('stock_receive'\).insert\(\[\{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      qty_doses: Number\(quantity\),
      remarks: notes \|\| null,
      destination_level: '1',
      batch_no: batch_no,
      batch_expiry_date: batch_expiry_date \|\| null,
      manufacture_name: manufacture_name \|\| null,
      state_id: req.user.state_id,
      created_by: getValidUuid\(req.user.id\)
    \}\]\).select\(\);

    if \(error\) throw error;
    
    // Update batch inventory for state level
    await updateBatchInventory\(batch_no, manufacture_name, batch_expiry_date, '1', req.user.state_id, null, null, null, Number\(quantity\), 0\);"""

new_receive = """    const { data, error } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      quantity_doses: Number(quantity),
      remarks: notes || null,
      level: '1',
      destination_level: '1',
      batch_no: batch_no,
      batch_expiry_date: batch_expiry_date || null,
      manufacture_name: manufacture_name || null,
      state_id: req.user.state_id,
      created_by: getValidUuid(req.user.id)
    }]).select();

    if (error) throw error;"""

content = re.sub(old_receive, new_receive, content)


# 4. Update /api/vaccine/stock/issue to use vaccine_stock_transactions
old_issue = r"""    // Check available stock for THIS BATCH at current level
    let batchQuery = supabase.from\('vaccine_batches'\).select\('\*'\).eq\('batch_no', batch_no\).eq\('level', String\(currentLevel\)\);
    if \(req.user.state_id\) batchQuery = batchQuery.eq\('state_id', req.user.state_id\);
    if \(isDistrictAdmin\) batchQuery = batchQuery.eq\('district_id', req.user.district_id\);
    
    const \{ data: batchData, error: bErr \} = await batchQuery.maybeSingle\(\);

    if \(bErr \|\| !batchData \|\| batchData.quantity < qty\) \{
      return res.status\(400\).json\(\{ error: `Insufficient stock for batch \$\{batch_no\}\. Available: \$\{batchData \? batchData.quantity : 0\}` \}\);
    \}

    // Insert ISSUE transaction
    const \{ data: issueTx, error: issueErr \} = await supabase.from\('stock_issue'\).insert\(\[\{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'ISSUED',
      transaction_date: date,
      qty_doses: qty,
      batch_no: batch_no,
      source_level: String\(currentLevel\),
      destination_level: String\(destLvl\),
      destination_ccl_name: destFacility.facility_name,
      remarks: notes \|\| null,
      state_id: req.user.state_id,
      district_id: req.user.district_id \|\| null,
      created_by: getValidUuid\(req.user.id\)
    \}\]\).select\(\).single\(\);

    if \(issueErr\) throw issueErr;

    // Insert downstream RECEIVED transaction
    const \{ error: recvErr \} = await supabase.from\('stock_receive'\).insert\(\[\{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      qty_doses: qty,
      batch_no: batch_no,
      batch_expiry_date: batchData.batch_expiry_date,
      manufacture_name: batchData.manufacture_name,
      source_level: String\(currentLevel\),
      destination_level: String\(destLvl\),
      destination_ccl_name: destFacility.facility_name,
      remarks: notes \|\| null,
      state_id: destFacility.state_id,
      district_id: destFacility.district_id,
      created_by: getValidUuid\(req.user.id\)
    \}\]\);

    if \(recvErr\) \{
       console.error\("Failed to create downstream receive record:", recvErr\);
       return res.status\(500\).json\(\{ error: 'Issue recorded, but downstream receipt failed.' \}\);
    \}

    // Update batch inventory: Deduct from source
    await updateBatchInventory\(batch_no, null, null, String\(currentLevel\), req.user.state_id, req.user.district_id \|\| null, null, null, -qty, 0\);

    // Update batch inventory: Add to destination
    let destBlockId = destFacility.block_id \|\| null;
    let destFacilityId = destFacility.id;
    await updateBatchInventory\(batch_no, batchData.manufacture_name, batchData.batch_expiry_date, String\(destLvl\), destFacility.state_id, destFacility.district_id, destBlockId, destFacilityId, qty, 0\);"""

new_issue = """    // Check available stock for THIS BATCH at current level
    const availableStock = await getBatchInventory(batch_no, currentLevel, req.user.state_id, req.user.district_id, null);

    if (availableStock < qty) {
      return res.status(400).json({ error: `Insufficient stock for batch ${batch_no}. Available: ${availableStock}` });
    }

    // Insert ISSUE transaction for source
    const { data: issueTx, error: issueErr } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'ISSUED',
      transaction_date: date,
      quantity_doses: qty,
      batch_no: batch_no,
      level: String(currentLevel),
      source_level: String(currentLevel),
      destination_level: String(destLvl),
      destination_ccl_name: destFacility.facility_name,
      destination_ccl_id: destFacility.ccl_id,
      remarks: notes || null,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      created_by: getValidUuid(req.user.id)
    }]).select().single();

    if (issueErr) throw issueErr;

    // Insert downstream RECEIVED transaction
    const { error: recvErr } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      quantity_doses: qty,
      batch_no: batch_no,
      level: String(destLvl),
      source_level: String(currentLevel),
      destination_level: String(destLvl),
      destination_ccl_name: destFacility.facility_name,
      destination_ccl_id: destFacility.ccl_id,
      remarks: notes || null,
      state_id: destFacility.state_id,
      district_id: destFacility.district_id,
      block_id: destFacility.block_id,
      facility_id: destFacility.id,
      created_by: getValidUuid(req.user.id)
    }]);

    if (recvErr) {
       console.error("Failed to create downstream receive record:", recvErr);
       return res.status(500).json({ error: 'Issue recorded, but downstream receipt failed.' });
    }"""

content = re.sub(old_issue, new_issue, content)

# 5. Update /api/vaccine/stock/month-end
old_month_end = r"""    // Get current batch quantity
    const \{ data: batchData \} = await supabase.from\('vaccine_batches'\).select\('\*'\)
      .eq\('batch_no', batch_no\)
      .eq\('level', String\(currentLevel\)\)
      .eq\('state_id', req.user.state_id\)
      .eq\(currentLevel === 2 \? 'district_id' : 'state_id', currentLevel === 2 \? req.user.district_id : req.user.state_id\)
      .single\(\);
      
    if \(!batchData\) \{
      return res.status\(400\).json\(\{ error: 'Batch not found at this level' \}\);
    \}
    
    const diff = Number\(quantity\) - batchData.quantity;

    const \{ data, error \} = await supabase.from\('monthly_balance'\).insert\(\[\{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'MONTH_END_BALANCE',
      transaction_date: month \+ '-01',
      qty_doses: Number\(quantity\),
      ccl_manager_handler_name: reportingPersonName,
      ccl_manager_handler_mobile_no: reportingPersonMobile,
      remarks: notes \|\| null,
      batch_no: batch_no,
      state_id: req.user.state_id,
      district_id: req.user.district_id \|\| null,
      created_by: getValidUuid\(req.user.id\)
    \}\]\).select\(\);

    if \(error\) throw error;
    
    // Update batch inventory to match the physical balance submitted
    if \(diff !== 0\) \{
      await updateBatchInventory\(batch_no, null, null, String\(currentLevel\), req.user.state_id, req.user.district_id \|\| null, null, null, diff, 0\);
    \}"""

new_month_end = """    const currentBal = await getBatchInventory(batch_no, currentLevel, req.user.state_id, req.user.district_id, null);
    const diff = Number(quantity) - currentBal;

    const { data, error } = await supabase.from('monthly_balance').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'MONTH_END_BALANCE',
      transaction_date: month + '-01',
      qty_doses: Number(quantity),
      ccl_manager_handler_name: reportingPersonName,
      ccl_manager_handler_mobile_no: reportingPersonMobile,
      remarks: notes || null,
      batch_no: batch_no,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      created_by: getValidUuid(req.user.id)
    }]).select();

    if (error) throw error;
    
    if (diff !== 0) {
      // Insert ADJUSTMENT transaction to sync physical balance
      await supabase.from('vaccine_stock_transactions').insert([{
        vaccine_type: 'HPV Vaccine',
        transaction_type: diff > 0 ? 'RECEIVED' : 'ISSUED',
        transaction_date: month + '-01',
        quantity_doses: Math.abs(diff),
        batch_no: batch_no,
        level: String(currentLevel),
        remarks: 'Auto-adjustment from Month End Balance: ' + (notes || ''),
        state_id: req.user.state_id,
        district_id: req.user.district_id || null,
        created_by: getValidUuid(req.user.id)
      }]);
    }"""

content = re.sub(old_month_end, new_month_end, content)

# 6. Update /api/vaccine/stock (history)
old_history = r"""     let recvQuery = supabase.from\('stock_receive'\).select\('\*'\).order\('created_at', \{ ascending: false \}\).limit\(25\);
     let issueQuery = supabase.from\('stock_issue'\).select\('\*'\).order\('created_at', \{ ascending: false \}\).limit\(25\);
     let balanceQuery = supabase.from\('monthly_balance'\).select\('\*'\).order\('created_at', \{ ascending: false \}\).limit\(25\);

     if \(req.user.state_id\) \{
        recvQuery = recvQuery.eq\('state_id', req.user.state_id\);
        issueQuery = issueQuery.eq\('state_id', req.user.state_id\);
        balanceQuery = balanceQuery.eq\('state_id', req.user.state_id\);
     \}
     if \(req.user.district_id\) \{
        recvQuery = recvQuery.eq\('district_id', req.user.district_id\);
        issueQuery = issueQuery.eq\('district_id', req.user.district_id\);
        balanceQuery = balanceQuery.eq\('district_id', req.user.district_id\);
     \}
     if \(req.user.block_id\) \{
        recvQuery = recvQuery.eq\('block_id', req.user.block_id\);
        issueQuery = issueQuery.eq\('block_id', req.user.block_id\);
        balanceQuery = balanceQuery.eq\('block_id', req.user.block_id\);
     \}
     if \(req.user.facility_id\) \{
        recvQuery = recvQuery.eq\('facility_id', req.user.facility_id\);
        issueQuery = issueQuery.eq\('facility_id', req.user.facility_id\);
        balanceQuery = balanceQuery.eq\('facility_id', req.user.facility_id\);
     \}

     const \[ \{data: recv\}, \{data: issue\}, \{data: bal\} \] = await Promise.all\(\[recvQuery, issueQuery, balanceQuery\]\);
     
     // Merge and sort
     const allTx = \[
       \.\.\.\(recv \|\| \[\]\).map\(t => \(\{...t, type: 'stock_receive', display_type: 'RECEIVED', quantity_doses: t.qty_doses\}\)\),
       \.\.\.\(issue \|\| \[\]\).map\(t => \(\{...t, type: 'stock_issue', display_type: 'ISSUED', quantity_doses: t.qty_doses\}\)\),
       \.\.\.\(bal \|\| \[\]\).map\(t => \(\{...t, type: 'monthly_balance', display_type: 'MONTH_END_BALANCE', quantity_doses: t.qty_doses\}\)\)
     \].sort\(\(a, b\) => new Date\(b.created_at\) - new Date\(a.created_at\)\);"""

new_history = """     let txQuery = supabase.from('vaccine_stock_transactions').select('*').order('created_at', { ascending: false }).limit(50);
     let balanceQuery = supabase.from('monthly_balance').select('*').order('created_at', { ascending: false }).limit(25);

     if (req.user.state_id) {
        txQuery = txQuery.eq('state_id', req.user.state_id);
        balanceQuery = balanceQuery.eq('state_id', req.user.state_id);
     }
     if (req.user.district_id) {
        txQuery = txQuery.eq('district_id', req.user.district_id);
        balanceQuery = balanceQuery.eq('district_id', req.user.district_id);
     }
     if (req.user.block_id) {
        txQuery = txQuery.eq('block_id', req.user.block_id);
        balanceQuery = balanceQuery.eq('block_id', req.user.block_id);
     }
     if (req.user.facility_id) {
        txQuery = txQuery.eq('facility_id', req.user.facility_id);
        balanceQuery = balanceQuery.eq('facility_id', req.user.facility_id);
     }

     const [ {data: txs}, {data: bal} ] = await Promise.all([txQuery, balanceQuery]);
     
     // Merge and sort
     const allTx = [
       ...(txs || []).map(t => ({...t, type: 'vaccine_stock_transactions', display_type: t.transaction_type})),
       ...(bal || []).map(t => ({...t, type: 'monthly_balance', display_type: 'MONTH_END_BALANCE', quantity_doses: t.qty_doses}))
     ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));"""

content = re.sub(old_history, new_history, content)

# 7. SuperAdmin CSV Upload Receive
old_super_receive = r"""      if \(toInsert.length > 0\) \{
        const \{ error \} = await supabase.from\('stock_receive'\).insert\(toInsert\);
        if \(error\) \{
          errors.push\(`Error inserting batch: \$\{error.message\}`\);
        \} else \{
          for \(const item of toInsert\) \{
             const destCcp = allCcps\?\.find\(c => c.ccl_id === item.destination_ccl_id\);
             const sId = destCcp\?.state_id \|\| req.user.state_id \|\| 5;
             const dId = destCcp\?.district_id \|\| null;
             const bId = destCcp\?.block_id \|\| null;
             const fId = destCcp\?.id \|\| null;
             await updateBatchInventory\(item.batch_no, item.manufacture_name, item.batch_expiry_date, item.destination_level, sId, dId, bId, fId, item.qty_doses, 0\);
          \}
          successCount \+= toInsert.length;
          details.push\(`Inserted \$\{toInsert.length\} receive transactions`\);
        \}
      \}"""

new_super_receive = """      if (toInsert.length > 0) {
        // Map fields for vaccine_stock_transactions
        const txToInsert = toInsert.map(item => ({
            ...item,
            quantity_doses: item.qty_doses,
            level: item.destination_level
        }));
        // Remove qty_doses to match schema if it doesn't exist
        txToInsert.forEach(t => delete t.qty_doses);
        
        const { error } = await supabase.from('vaccine_stock_transactions').insert(txToInsert);
        if (error) {
          errors.push(`Error inserting batch: ${error.message}`);
        } else {
          successCount += txToInsert.length;
          details.push(`Inserted ${txToInsert.length} receive transactions`);
        }
      }"""

content = re.sub(old_super_receive, new_super_receive, content)

# 8. SuperAdmin CSV Upload Issue
old_super_issue = r"""      if \(toInsertIssue.length > 0\) \{
        const \{ error: err1 \} = await supabase.from\('stock_issue'\).insert\(toInsertIssue\);
        const \{ error: err2 \} = await supabase.from\('stock_receive'\).insert\(toInsertReceive\);
        
        if \(err1 \|\| err2\) \{
          errors.push\(`Error inserting batch`\);
        \} else \{
          for \(const item of batchUpdates\) \{
             const srcCcp = allCcps\?\.find\(c => c.ccl_id === item.source_ccl_id\);
             const srcSId = srcCcp\?.state_id \|\| req.user.state_id \|\| 5;
             const srcDId = srcCcp\?.district_id \|\| null;
             const srcBId = srcCcp\?.block_id \|\| null;
             const srcFId = srcCcp\?.id \|\| null;
             
             const destCcp = allCcps\?\.find\(c => c.ccl_id === item.destination_ccl_id\);
             const destSId = destCcp\?.state_id \|\| req.user.state_id \|\| 5;
             const destDId = destCcp\?.district_id \|\| null;
             const destBId = destCcp\?.block_id \|\| null;
             const destFId = destCcp\?.id \|\| null;
             
             // await updateBatchInventory\(item.batch_no, item.mfg, null, item.src, srcSId, srcDId, srcBId, srcFId, -item.qty, 0\);
             await updateBatchInventory\(item.batch_no, item.mfg, null, item.dest, destSId, destDId, destBId, destFId, item.qty, 0\);
          \}
          successCount \+= toInsertIssue.length;
          details.push\(`Inserted \$\{toInsertIssue.length\} issue transactions`\);
        \}
      \}"""

new_super_issue = """      if (toInsertIssue.length > 0) {
        const issueTxToInsert = toInsertIssue.map(item => ({...item, quantity_doses: item.qty_doses, level: item.source_level}));
        const receiveTxToInsert = toInsertReceive.map(item => ({...item, quantity_doses: item.qty_doses, level: item.destination_level}));
        
        issueTxToInsert.forEach(t => delete t.qty_doses);
        receiveTxToInsert.forEach(t => delete t.qty_doses);
        
        const { error: err1 } = await supabase.from('vaccine_stock_transactions').insert(issueTxToInsert);
        const { error: err2 } = await supabase.from('vaccine_stock_transactions').insert(receiveTxToInsert);
        
        if (err1 || err2) {
          errors.push(`Error inserting batch`);
        } else {
          successCount += toInsertIssue.length;
          details.push(`Inserted ${toInsertIssue.length} issue transactions`);
        }
      }"""

content = re.sub(old_super_issue, new_super_issue, content)

# 9. Update /api/vaccine/monthly-report/submit
old_submit_report = r"""    const \{ data: batchData \} = await supabase.from\('vaccine_batches'\)
      .select\('quantity'\)
      .eq\('batch_no', batch_no\)
      .eq\('level', '3'\)
      .eq\('facility_id', facility_id\)
      .limit\(1\);
      
    const currentQty = \(batchData && batchData.length > 0\) \? Number\(batchData\[0\].quantity\) : 0;
    const diff = qty - currentQty;
    
    await updateBatchInventory\(batch_no, null, null, '3', req.user.state_id, req.user.district_id, req.user.block_id, facility_id, diff, 0\);"""

new_submit_report = """    const currentBal = await getBatchInventory(batch_no, '3', req.user.state_id, req.user.district_id, facility_id);
    const diff = qty - currentBal;
    
    if (diff !== 0) {
      await supabase.from('vaccine_stock_transactions').insert([{
        vaccine_type: 'HPV Vaccine',
        transaction_type: diff > 0 ? 'RECEIVED' : 'ISSUED',
        transaction_date: monthStart,
        quantity_doses: Math.abs(diff),
        batch_no: batch_no,
        level: '3',
        remarks: 'Auto-adjustment from Monthly CCP Report: ' + (remarks || ''),
        state_id: blockInfo?.state_id,
        district_id: blockInfo?.district_id,
        block_id: blockId,
        facility_id: facility_id,
        created_by: getValidUuid(req.user.id)
      }]);
    }"""

content = re.sub(old_submit_report, new_submit_report, content)

# 10. Blank out /api/superadmin/fix-batches as it uses old tables and isn't needed
old_fix_batches = r"""// TEMPORARY SCRIPT TO FIX BROKEN BATCHES
app.get\('/api/superadmin/fix-batches', async \(req, res\) => \{
  try \{
    if \(!useSupabase\) return res.json\(\{ error: 'Requires Supabase' \}\);

    const \{ data: allCcps \} = await supabase.from\('vaccine_ccp'\).select\('id, ccl_id, state_id, district_id, block_id'\);

    // FIX STOCK RECEIVE
    const \{ data: rxBroken \} = await supabase.from\('stock_receive'\).select\('\*'\).is\('block_id', null\).neq\('destination_level', '1'\);
    let fixedRx = 0;
    for \(const rx of rxBroken \|\| \[\]\) \{
       if \(rx.destination_ccl_id\) \{
          const ccp = allCcps.find\(c => c.ccl_id === rx.destination_ccl_id\);
          if \(ccp\) \{
             await supabase.from\('stock_receive'\).update\(\{ state_id: ccp.state_id, district_id: ccp.district_id, block_id: ccp.block_id, facility_id: ccp.id \}\).eq\('id', rx.id\);
             fixedRx\+\+;
          \}
       \}
    \}

    // FIX STOCK ISSUE
    const \{ data: txBroken \} = await supabase.from\('stock_issue'\).select\('\*'\).is\('block_id', null\).neq\('source_level', '1'\);
    let fixedTx = 0;
    for \(const tx of txBroken \|\| \[\]\) \{
       if \(tx.source_ccl_id\) \{
          const ccp = allCcps.find\(c => c.ccl_id === tx.source_ccl_id\);
          if \(ccp\) \{
             await supabase.from\('stock_issue'\).update\(\{ state_id: ccp.state_id, district_id: ccp.district_id, block_id: ccp.block_id, facility_id: ccp.id \}\).eq\('id', tx.id\);
             fixedTx\+\+;
          \}
       \}
    \}

    // Fix batches just in case
    const \{ data: brokenBatches \} = await supabase.from\('vaccine_batches'\).select\('\*'\).is\('district_id', null\).neq\('level', '1'\);
    let fixedB = 0;
    for \(const batch of brokenBatches \|\| \[\]\) \{
       const \{ data: recv \} = await supabase.from\('stock_receive'\).select\('destination_ccl_id'\).eq\('batch_no', batch.batch_no\).eq\('destination_level', batch.level\).order\('created_at', \{ ascending: false \}\).limit\(1\);
       if \(recv && recv.length > 0 && recv\[0\].destination_ccl_id\) \{
          const matchedCcp = allCcps.find\(c => c.ccl_id === recv\[0\].destination_ccl_id\);
          if \(matchedCcp\) \{
             await supabase.from\('vaccine_batches'\).update\(\{
                state_id: matchedCcp.state_id, district_id: matchedCcp.district_id, block_id: matchedCcp.block_id, facility_id: matchedCcp.id
             \}\).eq\('id', batch.id\);
             fixedB\+\+;
          \}
       \}
    \}

    // Fix batch expiry dates where they are null but another row has the expiry
    const \{ data: batches \} = await supabase.from\('vaccine_batches'\).select\('batch_no, batch_expiry_date'\).not\('batch_expiry_date', 'is', null\);
    const expiryMap = \{\};
    batches\?\.forEach\(b => expiryMap\[b.batch_no\] = b.batch_expiry_date\);
    
    let fixedExpiry = 0;
    const \{ data: nullBatches \} = await supabase.from\('vaccine_batches'\).select\('id, batch_no'\).is\('batch_expiry_date', null\);
    for \(const nb of nullBatches \|\| \[\]\) \{
       if \(expiryMap\[nb.batch_no\]\) \{
          await supabase.from\('vaccine_batches'\).update\(\{ batch_expiry_date: expiryMap\[nb.batch_no\] \}\).eq\('id', nb.id\);
          fixedExpiry\+\+;
       \}
    \}

    res.json\(\{ message: 'Fixed records', fixedRx, fixedTx, fixedBatches: fixedB, fixedExpiry \}\);
  \} catch \(err\) \{
    res.status\(500\).json\(\{ error: err.message, stack: err.stack \}\);
  \}
\}\);"""

new_fix_batches = """// TEMPORARY SCRIPT TO FIX BROKEN BATCHES (Deprecated)
app.get('/api/superadmin/fix-batches', async (req, res) => {
  res.json({ message: 'Deprecated route. Batches are now handled via stock transactions.' });
});"""

content = re.sub(old_fix_batches, new_fix_batches, content)

with open('server/index.js', 'w') as f:
    f.write(content)
