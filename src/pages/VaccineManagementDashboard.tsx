import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  FileText,
  UploadCloud,
  ArrowLeft
} from 'lucide-react';

export const VaccineManagementDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'upload'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-[100dvh] w-full bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden selection:bg-pink-100 selection:text-pink-900">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="bg-white rounded-[2rem] px-3 py-1 flex items-center justify-center shadow-sm shrink-0 border border-slate-200">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-10 w-auto object-contain" />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 text-slate-600 flex flex-col justify-between transition-all duration-300 lg:sticky lg:top-0 lg:h-[100dvh] lg:shrink-0 ${
        mobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full w-64'
      } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo Branding */}
          <div className={`p-4 border-b border-slate-200 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`${sidebarCollapsed ? 'lg:hidden' : 'block flex-1 min-w-0 mr-2'}`}>
              <div className="bg-white rounded-[2rem] px-3 py-1.5 flex items-center justify-center shadow-sm shrink-0 border border-slate-200">
                <img src="/headinglogo.png" alt="HPV Kavach Logo" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 shrink-0"
              title="Toggle Sidebar"
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-hide">
            {/* Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-pink-50 text-pink-700 shadow-sm border border-pink-100 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-pink-600'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Dashboard</span>
            </button>

            {/* Report */}
            <button
              onClick={() => setActiveTab('report')}
              title="Report"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'report'
                  ? 'bg-pink-50 text-pink-700 shadow-sm border border-pink-100 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-pink-600'
              }`}
            >
              <FileText className={`w-5 h-5 shrink-0 ${activeTab === 'report' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Report</span>
            </button>

            {/* Upload CSV */}
            <button
              onClick={() => setActiveTab('upload')}
              title="Upload CSV"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'upload'
                  ? 'bg-pink-50 text-pink-700 shadow-sm border border-pink-100 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-pink-600'
              }`}
            >
              <UploadCloud className={`w-5 h-5 shrink-0 ${activeTab === 'upload' ? 'text-pink-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Upload CSV</span>
            </button>
          </nav>

          {/* Dashboard Switcher Button */}
          <div className={`mx-3 mt-auto mb-2 shrink-0 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
            <button 
              onClick={() => { setMobileMenuOpen(false); navigate('/admin'); }}
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl py-2.5 font-bold transition-colors text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Monitoring Dashboard
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative lg:rounded-tl-2xl lg:border-l lg:border-t lg:border-slate-200 overflow-hidden shadow-inner">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-10 hidden lg:flex">
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
