const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const testRoute = `
app.get('/api/test/ccl', async (req, res) => {
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
});
`;

content = content.replace("app.get('/api/health', (req, res) => {", testRoute + "\napp.get('/api/health', (req, res) => {");

fs.writeFileSync(file, content);
console.log('Added test route');
