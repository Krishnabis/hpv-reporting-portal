const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

// Replace in selects
content = content.replace(/select\('to_ccl,/g, "select('facility_name,");
content = content.replace(/select\('id, ccl_id, to_ccl/g, "select('id, ccl_id, facility_name");
content = content.replace(/select\('ccl_id, to_ccl/g, "select('ccl_id, facility_name");
content = content.replace(/select\('id, to_ccl/g, "select('id, facility_name");
content = content.replace(/\.ilike\('to_ccl'/g, ".ilike('facility_name'");

// Replace in object property access where we know it's a vaccine_ccp record
content = content.replace(/ccp\.to_ccl/g, "ccp.facility_name");
content = content.replace(/cclMap\[u\.ccl_id\]\.to_ccl/g, "cclMap[u.ccl_id].facility_name");
content = content.replace(/f\.to_ccl/g, "f.facility_name");
content = content.replace(/fac\.to_ccl/g, "fac.facility_name");
content = content.replace(/ccpMap\[srcId\]\?\.to_ccl/g, "ccpMap[srcId]?.facility_name");
content = content.replace(/srcCcp\.to_ccl/g, "srcCcp.facility_name");
content = content.replace(/destCcp\.to_ccl/g, "destCcp.facility_name");
content = content.replace(/existing\.to_ccl/g, "existing.facility_name");
content = content.replace(/newObj\.to_ccl/g, "newObj.facility_name");
content = content.replace(/r\.to_ccl/g, "r.facility_name"); // Wait, in line 3834: r.to_ccl && r.block_id. This is uploading locations.

fs.writeFileSync(file, content);
console.log("Replaced to_ccl with facility_name");
