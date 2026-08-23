import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu,
  LayoutDashboard,
  FileText,
  Upload,
  ArrowLeft
} from 'lucide-react';

export const VaccineManagementDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'upload'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans selection:bg-pink-100 selection:text-pink-900">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col bg-white border-r border-slate-200
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-20' : 'w-72'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain shrink-0" />
            <div className={`flex flex-col ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
              <span className="text-sm font-black text-slate-800 tracking-tight leading-tight">Vaccine Management</span>
              <span className="text-[10px] font-bold text-pink-600 tracking-wider">DASHBOARD</span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          <nav className="px-3 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                activeTab === 'dashboard' ? 'bg-pink-50 text-pink-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                activeTab === 'report' ? 'bg-pink-50 text-pink-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'report' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Report</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                activeTab === 'upload' ? 'bg-pink-50 text-pink-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Upload className={`w-4 h-4 shrink-0 ${activeTab === 'upload' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Upload CSV</span>
            </button>
          </nav>
        </div>

        {/* Dashboard Switcher Button */}
        <div className={`mx-3 mb-4 shrink-0 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
          <button 
            onClick={() => { setMobileMenuOpen(false); navigate('/admin'); }}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl py-2.5 font-bold transition-colors text-xs shadow-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Monitoring
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && 'Vaccine Management Dashboard'}
              {activeTab === 'report' && 'Vaccine Inventory Report'}
              {activeTab === 'upload' && 'Upload Vaccine Data'}
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
              <LayoutDashboard className="w-16 h-16 text-slate-200 mb-4" />
              <h2 className="text-xl font-bold text-slate-700 mb-2">Empty Dashboard</h2>
              <p className="text-sm max-w-md">This is a placeholder for the <strong>{activeTab}</strong> view. We will add the data structure, tables, and metrics here in the next step.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
