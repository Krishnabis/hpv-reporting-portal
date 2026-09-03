const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const localUpdateRegex = /store\.daily_reports\[existingIdx\]\.beneficiaries_vaccinated = vaccinated;/;
if (content.match(localUpdateRegex)) {
  content = content.replace(localUpdateRegex, "store.daily_reports[existingIdx].beneficiaries_vaccinated = vaccinated;\n          store.daily_reports[existingIdx].sessions_held = sessions;");
  console.log("Replaced local update query");
} else {
  console.log("Local update query not found");
}

const localInsertRegex = /beneficiaries_vaccinated: vaccinated,/g;
if (content.match(localInsertRegex)) {
  // We need to only replace the one inside the livedata endpoint
  // Let's just use string replace for the specific block.
}
