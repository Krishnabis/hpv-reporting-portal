import fs from 'fs';

let content = fs.readFileSync('server/index.js', 'utf8');
content = content.replace(
  "const { data: ccps } = await ccpsQuery;\n\n    if (!ccps || ccps.length === 0) return res.json({ ccps: [] });",
  "const { data: ccps, error: ccpsErr } = await ccpsQuery;\n    if (ccpsErr) { console.error('CCP Query Error:', ccpsErr); return res.status(500).json({ error: ccpsErr.message }); }\n\n    if (!ccps || ccps.length === 0) return res.json({ ccps: [] });"
);

fs.writeFileSync('server/index.js', content);
console.log('Patched');
