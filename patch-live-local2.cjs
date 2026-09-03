const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /line_list_count: lineList,\s*beneficiaries_vaccinated: vaccinated,\s*submitted_by: 'Super Admin CSV'/;
if (content.match(regex)) {
  content = content.replace(regex, "line_list_count: lineList,\n            beneficiaries_vaccinated: vaccinated,\n            sessions_held: sessions,\n            submitted_by: 'Super Admin CSV'");
  console.log("Replaced local insert query");
} else {
  console.log("Local insert query not found");
}
fs.writeFileSync(file, content);
