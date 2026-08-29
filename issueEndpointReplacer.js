const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const regex = /app\.post\('\/api\/vaccine\/stock\/issue', authenticateToken, async \(req, res\) => \{[\s\S]*?\n\}\);/;

const replacement = `app.post('/api/vaccine/stock/issue', authenticateToken, async (req, res) => {
  try {
    const { date, quantity, destination_level, destination_facility_id, notes, batch_no } = req.body;
    if (!date || isNaN(Number(quantity)) || Number(quantity) <= 0 || !destination_level || !destination_facility_id || !batch_no) {
       return res.status(400).json({ error: 'Invalid input' });
    }

    const qty = Number(quantity);
    const destLvl = Number(destination_level);
    const isDistrictAdmin = !!req.user.district_id;
    const currentLevel = isDistrictAdmin ? 2 : 1;

    // Validate facility exists
    const { data: destFacility, error: fErr } = await supabase.from('vaccine_ccp').select('*').eq('id', destination_facility_id).single();
    if (fErr || !destFacility) return res.status(400).json({ error: 'Invalid destination facility' });

    if (String(destFacility.unit_level) !== String(destLvl)) {
       return res.status(400).json({ error: 'Facility unit level mismatch' });
    }

    if (isDistrictAdmin && destFacility.district_id !== req.user.district_id) {
       return res.status(403).json({ error: 'Cannot issue to a facility outside your district' });
    }

    // Check available stock for THIS BATCH at current level
    let batchQuery = supabase.from('vaccine_batches').select('*').eq('batch_no', batch_no).eq('level', String(currentLevel));
    if (req.user.state_id) batchQuery = batchQuery.eq('state_id', req.user.state_id);
    if (isDistrictAdmin) batchQuery = batchQuery.eq('district_id', req.user.district_id);
    
    const { data: batchData, error: bErr } = await batchQuery.maybeSingle();

    if (bErr || !batchData || batchData.quantity < qty) {
      return res.status(400).json({ error: \`Insufficient stock for batch \${batch_no}. Available: \${batchData ? batchData.quantity : 0}\` });
    }

    // Insert ISSUE transaction
    const { data: issueTx, error: issueErr } = await supabase.from('stock_issue').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'ISSUED',
      transaction_date: date,
      qty_doses: qty,
      batch_no: batch_no,
      source_level: String(currentLevel),
      destination_level: String(destLvl),
      destination_ccl_name: destFacility.facility_name,
      remarks: notes || null,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      created_by: req.user.id
    }]).select().single();

    if (issueErr) throw issueErr;

    // Insert downstream RECEIVED transaction
    const { error: recvErr } = await supabase.from('stock_receive').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      qty_doses: qty,
      batch_no: batch_no,
      batch_expiry_date: batchData.batch_expiry_date,
      manufacture_name: batchData.manufacture_name,
      source_level: String(currentLevel),
      destination_level: String(destLvl),
      destination_ccl_name: destFacility.facility_name,
      remarks: notes || null,
      state_id: destFacility.state_id,
      district_id: destFacility.district_id,
      created_by: req.user.id
    }]);

    if (recvErr) {
       console.error("Failed to create downstream receive record:", recvErr);
       return res.status(500).json({ error: 'Issue recorded, but downstream receipt failed.' });
    }

    // Update batch inventory: Deduct from source
    await updateBatchInventory(batch_no, null, null, String(currentLevel), req.user.state_id, req.user.district_id || null, null, null, -qty, 0);

    // Update batch inventory: Add to destination
    let destBlockId = destFacility.block_id || null;
    let destFacilityId = destFacility.id;
    await updateBatchInventory(batch_no, batchData.manufacture_name, batchData.batch_expiry_date, String(destLvl), destFacility.state_id, destFacility.district_id, destBlockId, destFacilityId, qty, 0);

    // Keep old block balance math just in case
    if (destFacility.block_id) {
       const { data: oldBData } = await supabase.from('blocks').select('balance_vaccine').eq('id', destFacility.block_id).single();
       if (oldBData) {
          await supabase.from('blocks').update({ balance_vaccine: (oldBData.balance_vaccine || 0) + qty }).eq('id', destFacility.block_id);
       }
    }

    res.json({ success: true, transaction: issueTx });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});`;

code = code.replace(regex, replacement);
fs.writeFileSync('server/index.js', code);
