import fs from 'fs';

let content = fs.readFileSync('src/pages/BlockReporting.tsx', 'utf8');

// Remove state variables
content = content.replace(/\/\/ Monthly Report State[\s\S]*?const \[stockMsg, setStockMsg\] = useState<\{type: 'success'\|'error', text: string\} \| null>\(null\);/, '');

// Remove fetchBatches and fetchBlockMonthlyReport
content = content.replace(/const fetchBatches = \(level\?: string\) => \{[\s\S]*?console\.error\(err\)\);\n  \};\n\n  const fetchBlockMonthlyReport = async \(month: string\) => \{[\s\S]*?setFetchingCcpStatus\(false\);\n  \};/, '');

// Update the Monthly Report button to navigate
content = content.replace(/setShowMonthlyReportModal\(true\);/, `navigate('/monthly-report?blockId=' + blockId);`);

// Remove the modal UI
content = content.replace(/\{showMonthlyReportModal && \([\s\S]*?<\/[a-zA-Z]+>\n\s*\)\}\n\n\s*\{showChangePasscodeModal && \(/, '{showChangePasscodeModal && (');

fs.writeFileSync('src/pages/BlockReporting.tsx', content);
console.log('File updated successfully');
