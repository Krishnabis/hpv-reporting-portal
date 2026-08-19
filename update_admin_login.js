const fs = require('fs');

const path = 'src/pages/AdminLogin.tsx';
let content = fs.readFileSync(path, 'utf8');

// Container
content = content.replace('bg-slate-900 flex flex-col', 'bg-slate-50 flex flex-col');

// Header
content = content.replace('bg-slate-800 rounded-[2rem]', 'bg-white rounded-[2rem]');
content = content.replace('text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/10', 'text-hpv-purple hover:text-hpv-purple-dark px-3 py-1.5 rounded-lg bg-hpv-purple-soft');

// Main Form Box
content = content.replace('bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl', 'bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60');

// Title & Subtitle
content = content.replace('text-2xl font-extrabold text-white', 'text-2xl font-extrabold text-slate-900');
content = content.replace('text-xs text-slate-400 mt-1', 'text-xs text-slate-500 mt-1');

// Inputs & Labels
content = content.replaceAll('text-slate-300', 'text-slate-700');
content = content.replaceAll('bg-slate-900/80 border border-slate-700', 'bg-slate-50 border border-slate-300');
content = content.replaceAll('text-white focus:outline-none', 'text-slate-900 focus:outline-none');

// Footer
content = content.replace('border-slate-700/60 text-center text-xs text-slate-400', 'border-slate-100 text-center text-xs text-slate-500');

fs.writeFileSync(path, content);
console.log('AdminLogin light theme applied');
