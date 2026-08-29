const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const replacement = `// ─── Super Admin CSV Uploads: Stock Receive & Issue ─────────────────────────────────

app.post('/api/superadmin/upload-stock-receive', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let successCount = 0;
    let errors = [];
    let details = [];

    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const toInsert = [];

      for (const row of chunk) {
        if (!row['Batch No'] || !row['Quantity'] || !row['Date']) {
           errors.push(\`Row missing required fields\`);
           continue;
        }

        toInsert.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'RECEIVED',
          transaction_date: row['Date'],
          qty_doses: Number(row['Quantity']) || 0,
          batch_no: row['Batch No'],
          batch_expiry_date: row['Batch Expiry'] || null,
          manufacture_name: row['Manufacturer'] || null,
          vvm_status: row['VVM Status'] || null,
          source_level: row['Source Level'] || null,
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_level: row['Destination Level'] || '1',
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: req.user.id
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('stock_receive').insert(toInsert);
        if (error) {
          errors.push(\`Error inserting batch: \${error.message}\`);
        } else {
          // Update batch inventory for each item
          for (const item of toInsert) {
             // We are not resolving state/district from ID yet for bulk upload unless we do a DB lookup, 
             // but we'll try to just record it. Usually state_id is 5 for Uttarakhand.
             await updateBatchInventory(item.batch_no, item.manufacture_name, item.batch_expiry_date, item.destination_level, 5, null, null, null, item.qty_doses, 0);
          }
          successCount += toInsert.length;
          details.push(\`Inserted \${toInsert.length} receive transactions\`);
        }
      }
    }
    res.json({ successCount, errors, details });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack }); }
});

app.post('/api/superadmin/upload-stock-issue', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let successCount = 0;
    let errors = [];
    let details = [];

    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const toInsertIssue = [];
      const toInsertReceive = [];
      const batchUpdates = [];

      for (const row of chunk) {
        if (!row['Batch No'] || !row['Quantity'] || !row['Date']) {
           errors.push(\`Row missing required fields\`);
           continue;
        }
        
        let qty = Number(row['Quantity']) || 0;
        let batch_no = row['Batch No'];
        
        toInsertIssue.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'ISSUED',
          transaction_date: row['Date'],
          qty_doses: qty,
          batch_no: batch_no,
          manufacture_name: row['Manufacturer'] || null,
          source_level: row['Source Level'] || '1',
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_level: row['Destination Level'] || null,
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: req.user.id
        });
        
        toInsertReceive.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'RECEIVED',
          transaction_date: row['Date'],
          qty_doses: qty,
          batch_no: batch_no,
          manufacture_name: row['Manufacturer'] || null,
          source_level: row['Source Level'] || '1',
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_level: row['Destination Level'] || null,
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: req.user.id
        });
        
        batchUpdates.push({
           batch_no, mfg: row['Manufacturer'], dest: row['Destination Level'], src: row['Source Level'], qty
        });
      }

      if (toInsertIssue.length > 0) {
        const { error: err1 } = await supabase.from('stock_issue').insert(toInsertIssue);
        const { error: err2 } = await supabase.from('stock_receive').insert(toInsertReceive);
        
        if (err1 || err2) {
          errors.push(\`Error inserting batch\`);
        } else {
          for (const item of batchUpdates) {
             // Deduct from source
             await updateBatchInventory(item.batch_no, item.mfg, null, item.src, 5, null, null, null, -item.qty, 0);
             // Add to destination
             await updateBatchInventory(item.batch_no, item.mfg, null, item.dest, 5, null, null, null, item.qty, 0);
          }
          successCount += toInsertIssue.length;
          details.push(\`Inserted \${toInsertIssue.length} issue transactions\`);
        }
      }
    }
    res.json({ successCount, errors, details });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────`;

code = code.replace('// ─── Start ────────────────────────────────────────────────────────────────────', replacement);
fs.writeFileSync('server/index.js', code);
