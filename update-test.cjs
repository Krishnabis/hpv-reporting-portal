const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const oldTest = `app.get('/api/test/ccl', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vaccine_ccp')
      .select('*, states(name), districts(name), blocks(name)')
      .limit(1);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.json({ error: err.message, details: err });
  }
});`;

const newTest = `app.get('/api/test/ccl', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vaccine_ccp')
      .select('*, states(name), districts(name), blocks(name)')
      .in('unit_level', ['1', '2', '3'])
      .order('unit_level', { ascending: true })
      .order('to_ccl', { ascending: true })
      .limit(1);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.json({ error: err.message, details: err });
  }
});`;

content = content.replace(oldTest, newTest);
fs.writeFileSync(file, content);
console.log('Updated test route');
