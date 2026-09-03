const fs = require('fs');
const content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');
console.log(content.indexOf('Right Side Carousel'));
