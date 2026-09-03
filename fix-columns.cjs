const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

// Fix api/superadmin/ccl-list
content = content.replace(
  `.order('to_ccl', { ascending: true });`,
  `.order('facility_name', { ascending: true });`
); // this will replace the first occurrence (which is inside ccl-locations or ccl-list, but let's do a global replace for all .order('to_ccl'...)
content = content.replace(/\.order\('to_ccl'/g, `.order('facility_name'`);

// Fix c.to_ccl in ccl-locations filter
content = content.replace(
  `c.to_ccl && c.to_ccl.toLowerCase().includes(s)`,
  `c.facility_name && c.facility_name.toLowerCase().includes(s)`
);

// Fix allowedFields in server/index.js (if applicable)
content = content.replace(
  `'lgd_block_code', 'to_ccl', 'sub_district_name'`,
  `'lgd_block_code', 'facility_name', 'sub_district_name'`
);

// Let's also fix the test route I just made
content = content.replace(
  `.order('to_ccl', { ascending: true })`,
  `.order('facility_name', { ascending: true })`
);

fs.writeFileSync(file, content);
console.log('Fixed column names');
