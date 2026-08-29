// Batch Helper
async function updateBatchInventory(batch_no, manufacture_name, batch_expiry_date, level, state_id, district_id, block_id, facility_id, qty_change, vaccinated_change) {
  if (!batch_no || !level) return;
  let query = supabase.from('vaccine_batches').select('*').eq('batch_no', batch_no).eq('level', level);
  if (state_id) query = query.eq('state_id', state_id);
  if (district_id) query = query.eq('district_id', district_id);
  if (block_id) query = query.eq('block_id', block_id);
  if (facility_id) query = query.eq('facility_id', facility_id);
  
  const { data: existing } = await query.limit(1);
  if (existing && existing.length > 0) {
    const row = existing[0];
    const newQty = Number(row.quantity) + Number(qty_change || 0);
    const newVaccQty = Number(row.vaccinated_qty) + Number(vaccinated_change || 0);
    // Prepare update payload. Only update expiry/manufacturer if provided
    let updatePayload = { quantity: newQty, vaccinated_qty: newVaccQty, updated_at: new Date().toISOString() };
    if (manufacture_name) updatePayload.manufacture_name = manufacture_name;
    if (batch_expiry_date) updatePayload.batch_expiry_date = batch_expiry_date;
    
    await supabase.from('vaccine_batches').update(updatePayload).eq('id', row.id);
  } else {
    // Insert new
    await supabase.from('vaccine_batches').insert([{
      batch_no,
      manufacture_name: manufacture_name || null,
      batch_expiry_date: batch_expiry_date || null,
      level,
      state_id: state_id || null,
      district_id: district_id || null,
      block_id: block_id || null,
      facility_id: facility_id || null,
      quantity: Number(qty_change || 0),
      vaccinated_qty: Number(vaccinated_change || 0)
    }]);
  }
}
