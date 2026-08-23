import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Add states for sidebar groups
state_str = """  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'trend' | 'locations' | 'users' | 'settings' | 'audit' | 'population' | 'upload' | 'activity'>('dashboard');
  
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [usersOpen, setUsersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);"""

content = re.sub(r'  const \[activeTab, setActiveTab\] = useState[^;]+;', state_str, content)

# Update handleTabChange to also expand groups
handle_str = """  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'reports' || tab === 'trend') setAnalyticsOpen(true);
    if (tab === 'users' || tab === 'activity') setUsersOpen(true);
    if (tab === 'upload' || tab === 'settings') setSettingsOpen(true);"""

content = re.sub(r'  const handleTabChange = \(tab: any\) => \{\n    setActiveTab\(tab\);\n    setMobileMenuOpen\(false\);', handle_str, content)


# Replace the navigation block
nav_str = """          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {/* Dashboard */}
            <button
              onClick={() => handleTabChange('dashboard')}
              title="Dashboard"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm shadow-emerald-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Dashboard</span>
            </button>

            {/* Alerts */}
            <button
              onClick={() => handleTabChange('population')}
              title="Alerts"
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                activeTab === 'population'
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
              }`}
            >
              <div className="relative">
                <Bell className={`w-5 h-5 shrink-0 ${activeTab === 'population' ? 'text-emerald-600' : 'text-slate-400'}`} />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </div>
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Alerts</span>
              {!sidebarCollapsed && (
                <span className={`ml-auto py-0.5 px-2 rounded-full text-[10px] font-bold ${alertCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                  {alertCount}
                </span>
              )}
            </button>

            {/* Analytics */}
            <div className="pt-2">
              <button 
                onClick={() => { if (!sidebarCollapsed) setAnalyticsOpen(!analyticsOpen) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                title="Analytics"
              >
                <span className={sidebarCollapsed ? 'hidden' : ''}>Analytics</span>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${analyticsOpen ? '' : '-rotate-90'}`} />
                )}
              </button>
              
              {(analyticsOpen || sidebarCollapsed) && (
                <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                  <button
                    onClick={() => handleTabChange('reports')}
                    title="Reports"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'reports' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'reports' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Reports</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('trend')}
                    title="Trend"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'trend' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className={`w-4 h-4 shrink-0 ${activeTab === 'trend' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Trend</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Management */}
            {adminUser?.role === 'SUPER_ADMIN' && (
              <div className="pt-2">
                <button 
                  onClick={() => { if (!sidebarCollapsed) setUsersOpen(!usersOpen) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title="User Management"
                >
                  <span className={sidebarCollapsed ? 'hidden' : ''}>User Management</span>
                  {!sidebarCollapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${usersOpen ? '' : '-rotate-90'}`} />
                  )}
                </button>
                
                {(usersOpen || sidebarCollapsed) && (
                  <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                    <button
                      onClick={() => handleTabChange('users')}
                      title="Admin Users"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'users' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <UsersIcon className={`w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Admin Users</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('activity')}
                      title="Activity"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'activity' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'activity' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Activity</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            {adminUser?.role === 'SUPER_ADMIN' && (
              <div className="pt-2">
                <button 
                  onClick={() => { if (!sidebarCollapsed) setSettingsOpen(!settingsOpen) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title="Settings"
                >
                  <span className={sidebarCollapsed ? 'hidden' : ''}>Settings</span>
                  {!sidebarCollapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? '' : '-rotate-90'}`} />
                  )}
                </button>
                
                {(settingsOpen || sidebarCollapsed) && (
                  <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                    <button
                      onClick={() => handleTabChange('upload')}
                      title="Upload CSV"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'upload' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <UploadCloud className={`w-4 h-4 shrink-0 ${activeTab === 'upload' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Upload CSV</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('settings')}
                      title="Update Password"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'settings' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <SettingsIcon className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Update Password</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>"""

pattern = re.compile(r'\{\/\*\s*Navigation Links\s*\*\/\}.*?<\/nav>', re.DOTALL)
content = pattern.sub(nav_str, content)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(content)

