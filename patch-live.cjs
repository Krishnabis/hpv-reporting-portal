const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /let lineList = parseInt\(llStr, 10\);\s*let vaccinated = parseInt\(vaccStr, 10\);/;

if (content.match(regex)) {
  const replacement = `const sessStr = row.session || row.sessions || row.Session || row.Sessions || '0';
      let lineList = parseInt(llStr, 10);
      let vaccinated = parseInt(vaccStr, 10);
      let sessions = parseInt(sessStr, 10);
      if (isNaN(sessions)) sessions = 0;`;
  content = content.replace(regex, replacement);
  console.log("Replaced parsing block");
} else {
  console.log("Parsing block not found");
}

const updateRegex = /supabase\.from\('daily_reports'\)\.update\(\{ line_list_count: lineList, beneficiaries_vaccinated: vaccinated \}\)\.eq\('id', existing\.id\);/;
if (content.match(updateRegex)) {
  content = content.replace(updateRegex, "supabase.from('daily_reports').update({ line_list_count: lineList, beneficiaries_vaccinated: vaccinated, sessions_held: sessions }).eq('id', existing.id);");
  console.log("Replaced update query");
} else {
  console.log("Update query not found");
}

const insertRegex = /supabase\.from\('daily_reports'\)\.insert\(\[\{ id: reportId, block_id: blockId, reporting_date: reportingDate, line_list_count: lineList, beneficiaries_vaccinated: vaccinated, submitted_by: 'Super Admin CSV' \}\]\);/;
if (content.match(insertRegex)) {
  content = content.replace(insertRegex, "supabase.from('daily_reports').insert([{ id: reportId, block_id: blockId, reporting_date: reportingDate, line_list_count: lineList, beneficiaries_vaccinated: vaccinated, sessions_held: sessions, submitted_by: 'Super Admin CSV' }]);");
  console.log("Replaced insert query");
} else {
  console.log("Insert query not found");
}

const pushDetailsRegex = /details\.push\(\`Added live data \(Line list: \$\{lineList\}, Vaccinated: \$\{vaccinated\}, Date: \$\{reportingDate\}\)/;
if (content.match(pushDetailsRegex)) {
  content = content.replace(pushDetailsRegex, "details.push(`Added live data (Line list: ${lineList}, Vaccinated: ${vaccinated}, Sessions: ${sessions}, Date: ${reportingDate})");
  console.log("Replaced details message");
}

fs.writeFileSync(file, content);
