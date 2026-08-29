// Pseudo code for helper
async function updateBatchInventory(supabase, {
  batch_no,
  manufacture_name,
  batch_expiry_date,
  level,
  state_id,
  district_id,
  block_id,
  facility_id,
  qty_change,
  vaccinated_change
}) {
  // Find existing batch row
  // If exists, update quantity
  // If not, insert
}
