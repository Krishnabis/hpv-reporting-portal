const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');
const filesToUpdate = [
  'pages/DailyProgressReport.tsx',
  'pages/ReportingCompleteness.tsx',
  'pages/ColdChainLocations.tsx',
  'pages/VaccineStockMonitoringReport.tsx',
  'pages/VaccineStockLedger.tsx',
  'components/LocationMaster.tsx',
];

filesToUpdate.forEach(file => {
  const filePath = path.join(directoryPath, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace hardcoded purples in gradients and borders
    content = content.replace(/#3B1C63/gi, '#3A0088');
    content = content.replace(/#522B85/gi, '#3A0088');
    content = content.replace(/#6d3aad/gi, '#3A0088');
    content = content.replace(/rgba\(59,28,99,0\.04\)/g, 'rgba(58,0,136,0.04)');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

// Update tailwind.config.js
const tailwindPath = path.join(__dirname, 'tailwind.config.js');
if (fs.existsSync(tailwindPath)) {
  let content = fs.readFileSync(tailwindPath, 'utf8');
  content = content.replace(/DEFAULT:\s*["']#3B1C63["']/i, 'DEFAULT: "#3A0088"');
  content = content.replace(/dark:\s*["']#2D1250["']/i, 'dark: "#3A0088"');
  content = content.replace(/light:\s*["']#522B85["']/i, 'light: "#3A0088"');
  // I will also change 'soft' slightly to match the hue if needed, but it's probably fine to leave soft alone 
  // because soft is usually for hover backgrounds on lists. Let's just update the main three.
  fs.writeFileSync(tailwindPath, content, 'utf8');
  console.log(`Updated tailwind.config.js`);
}
