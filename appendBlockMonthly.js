const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const replacement = `// ─── Block Monthly Report (CCPs) ────────────────────────────────────────────────

app.get('/api/vaccine/monthly-report/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'BLOCK') return res.status(403).json({ error: 'Block Admin only' });
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ error: 'Month is required' });

    // 1. Fetch all CCPs for this block
    const { data: ccps } = await supabase.from('vaccine_ccp')
      .select('id, facility_name, ccl_manager_handler_name, ccl_manager_handler_mobile_no')
      .eq('block_id', req.user.block_id)
      .eq('unit_level', '3')
      .order('facility_name');

    if (!ccps || ccps.length === 0) return res.json({ ccps: [] });

    // 2. Fetch monthly balances for this block and month
    const monthStart = month + '-01';
    const { data: balances } = await supabase.from('monthly_balance')
      .select('facility_id')
      .eq('block_id', req.user.block_id)
      .eq('transaction_date', monthStart);

    const enteredFacilityIds = new Set((balances || []).map(b => b.facility_id));

    const result = ccps.map(ccp => ({
       ...ccp,
       status: enteredFacilityIds.has(ccp.id) ? 'Entered' : 'Pending'
    }));

    res.json({ ccps: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vaccine/monthly-report/submit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'BLOCK') return res.status(403).json({ error: 'Block Admin only' });
    
    const { month, facility_id, facility_name, batch_no, quantity, handler_name, handler_mobile, remarks } = req.body;
    if (!month || !facility_id || !batch_no || isNaN(Number(quantity)) || Number(quantity) < 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const qty = Number(quantity);
    const monthStart = month + '-01';
    
    // Check if already submitted
    const { data: existing } = await supabase.from('monthly_balance')
      .select('id')
      .eq('facility_id', facility_id)
      .eq('transaction_date', monthStart)
      .eq('batch_no', batch_no)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Balance already submitted for this CCP and Batch for the selected month.' });
    }

    // Insert into monthly_balance
    const { data, error } = await supabase.from('monthly_balance').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'MONTH_END_BALANCE',
      transaction_date: monthStart,
      qty_doses: qty,
      batch_no: batch_no,
      state_id: req.user.state_id,
      district_id: req.user.district_id,
      block_id: req.user.block_id,
      facility_id: facility_id,
      ccl_name: facility_name,
      ccl_manager_handler_name: handler_name,
      ccl_manager_handler_mobile_no: handler_mobile,
      remarks: remarks || null,
      created_by: req.user.id
    }]).select();

    if (error) throw error;
    
    // Since this is month END balance, it overrides the current inventory for this CCP
    // However, updating inventory directly from month-end balance can be tricky because it represents a snapshot.
    // We will update the inventory quantity to precisely match this balance.
    // Wait, the helper adds/subtracts. To SET it, we need to find current and adjust.
    const { data: batchData } = await supabase.from('vaccine_batches')
      .select('quantity')
      .eq('batch_no', batch_no)
      .eq('level', '3')
      .eq('facility_id', facility_id)
      .limit(1);
      
    const currentQty = (batchData && batchData.length > 0) ? Number(batchData[0].quantity) : 0;
    const diff = qty - currentQty;
    
    await updateBatchInventory(batch_no, null, null, '3', req.user.state_id, req.user.district_id, req.user.block_id, facility_id, diff, 0);

    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vaccine/batches', authenticateToken, async (req, res) => {
  try {
    const { level, facility_id } = req.query;
    let query = supabase.from('vaccine_batches').select('*').gt('quantity', 0);
    
    if (level) query = query.eq('level', level);
    if (req.user.role === 'BLOCK' || req.user.block_id) {
       query = query.eq('block_id', req.user.block_id);
    } else if (req.user.district_id) {
       query = query.eq('district_id', req.user.district_id);
    } else if (req.user.state_id) {
       query = query.eq('state_id', req.user.state_id);
    }
    
    if (facility_id) query = query.eq('facility_id', facility_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────`;

code = code.replace('// ─── Start ────────────────────────────────────────────────────────────────────', replacement);
fs.writeFileSync('server/index.js', code);
