const fs = require('fs');
const path = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Sidebar Main Container
content = content.replace(
  'bg-slate-900 text-slate-300 flex flex-col justify-between transition-all',
  'bg-white border-r border-slate-200 text-slate-600 flex flex-col justify-between transition-all'
);

// Mobile Topbar
content = content.replace(
  'bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40',
  'bg-white border-b border-slate-200 text-slate-900 p-4 flex items-center justify-between sticky top-0 z-40'
);

// Mobile Sidebar Toggle Buttons
content = content.replace('bg-slate-800 text-slate-300 hover:text-white', 'bg-slate-100 text-slate-600 hover:text-slate-900');
content = content.replace('bg-slate-800 text-slate-400 hover:text-white', 'bg-slate-100 text-slate-600 hover:text-slate-900');

// Logo Container Borders
content = content.replace('border-b border-slate-800', 'border-b border-slate-200');

// Logo pill background
content = content.replaceAll('bg-slate-800 rounded-[2rem]', 'bg-white border border-slate-200 rounded-[2rem]');

// Buttons (active vs inactive state styling)
// Inactive:
content = content.replaceAll('text-slate-300 hover:bg-slate-800 hover:text-white', 'text-slate-600 hover:bg-slate-100 hover:text-slate-900');
// Active:
content = content.replaceAll('bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20', 'bg-hpv-purple-soft text-hpv-purple font-bold shadow-sm shadow-hpv-purple/10');

// Remove Locations and Users buttons
content = content.replace(/<button[\s\S]*?handleTabChange\('locations'\)[\s\S]*?<\/button>/, '');
content = content.replace(/<button[\s\S]*?handleTabChange\('users'\)[\s\S]*?<\/button>/, '');

// Add Population Button below Reports
const reportsBtnRegex = /(<button[\s\S]*?handleTabChange\('reports'\)[\s\S]*?<\/button>)/;
const popBtn = `
            <button
              onClick={() => handleTabChange('population')}
              title="Population"
              className={\`w-full flex items-center \${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all \${
                activeTab === 'population'
                  ? 'bg-hpv-purple-soft text-hpv-purple font-bold shadow-sm shadow-hpv-purple/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }\`}
            >
              <Users className={\`w-5 h-5 shrink-0 \${activeTab === 'population' ? 'text-hpv-purple' : 'text-slate-400'}\`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Population</span>
            </button>`;
content = content.replace(reportsBtnRegex, `$1\n${popBtn}`);

// User Info Footer
content = content.replace('border-t border-slate-800', 'border-t border-slate-200');
content = content.replace('text-white font-bold', 'text-slate-900 font-bold');
content = content.replace('text-slate-400 text-xs truncate', 'text-slate-500 text-xs truncate');
content = content.replace('hover:bg-rose-500/20 hover:text-rose-400', 'hover:bg-rose-50 hover:text-rose-600 text-slate-400');
content = content.replace('text-slate-500', 'text-slate-400');

fs.writeFileSync(path, content);
console.log('Sidebar theme updated');
