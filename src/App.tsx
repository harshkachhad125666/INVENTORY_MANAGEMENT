import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  CreditCard, 
  Menu, 
  X, 
  RefreshCw, 
  UserCheck, 
  AlertCircle
} from 'lucide-react';
import Dashboard from './components/Dashboard.tsx';
import Inventory from './components/Inventory.tsx';
import BillingTerminal from './components/BillingTerminal.tsx';
import { offlineApi } from './offlineApi.ts';

type TabType = 'dashboard' | 'inventory' | 'billing';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [triggerRefresh, setTriggerRefresh] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Poll for low-stock triggers to show alerts on the left sidebar badge
  const updateLowStockBadge = async () => {
    try {
      const data = await offlineApi.getDashboardAnalytics();
      if (data.success) {
        setLowStockCount(data.analytics.overview.activeLowStockAlerts);
      }
    } catch (err) {
      console.warn('Silent badge updating failed loading server endpoints:', err);
    }
  };

  useEffect(() => {
    updateLowStockBadge();
  }, [triggerRefresh]);

  const handleGlobalRefresh = () => {
    setTriggerRefresh(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-[#0A0B0E] flex flex-col md:flex-row font-sans text-[#E2E8F0] antialiased" id="app-layout">
      
      {/* MOBILE HEADER RESPOND CONTAINER */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 bg-[#111318] text-[#E2E8F0] border-b border-[#2D3748] shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#00D1FF] rounded mr-1"></div>
          <span className="font-bold tracking-widest text-[#00D1FF] text-xs uppercase">STRATOS.OS</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(prev => !prev)}
          className="p-1 px-2.5 bg-[#15181F] border border-[#23272F] rounded-lg hover:bg-[#23272F] transition text-[#718096] hover:text-[#E2E8F0]"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* FLOATING ABSOLUTE SIDEBAR NAVIGATION */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#111318] text-[#E2E8F0] p-5 flex flex-col justify-between border-r border-[#2D3748] transition-transform duration-300 transform
        md:translate-x-0 md:static md:flex md:w-64 md:h-screen shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* UPPER NAVIGATION */}
        <div className="space-y-6">
          
          {/* BRAND LABEL */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#23272F]">
            <div className="w-6 h-6 rounded bg-[#00D1FF] flex-shrink-0 animate-pulse"></div>
            <div>
              <h1 className="font-bold text-[14px] uppercase tracking-widest text-[#00D1FF] leading-none">STRATOS.OS</h1>
              <p className="text-[10px] text-[#718096] font-semibold tracking-wider mt-1 uppercase">Retail Intelli-POS</p>
            </div>
          </div>

          {/* ACTIVE DIRECT NAVIGATION GROUP */}
          <nav className="space-y-1.5" id="nav-group">
            
            {/* Tab 1: Dashboard Insights */}
            <button
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              id="sidebar-tab-dashboard"
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-xs font-semibold uppercase tracking-wider ${
                activeTab === 'dashboard' 
                  ? 'bg-gradient-to-r from-[rgba(0,209,255,0.1)] to-transparent text-[#E2E8F0] border-l-3 border-[#00D1FF] font-bold' 
                  : 'text-[#718096] hover:bg-[#15181F]/40 hover:text-[#E2E8F0]'
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 size={15} />
                <span>Dashboard Overview</span>
              </div>
            </button>

            {/* Tab 2: Inventory Catalog */}
            <button
              onClick={() => { setActiveTab('inventory'); setSidebarOpen(false); }}
              id="sidebar-tab-inventory"
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-xs font-semibold uppercase tracking-wider ${
                activeTab === 'inventory' 
                  ? 'bg-gradient-to-r from-[rgba(0,209,255,0.1)] to-transparent text-[#E2E8F0] border-l-3 border-[#00D1FF] font-bold' 
                  : 'text-[#718096] hover:bg-[#15181F]/40 hover:text-[#E2E8F0]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package size={15} />
                <span>Product Catalog</span>
              </div>
              {lowStockCount > 0 && (
                <span className="bg-[#F56565]/20 border border-[#F56565] text-[#F56565] text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm inline-flex leading-none align-middle justify-center text-center animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Tab 3: POS Billing Terminal */}
            <button
              onClick={() => { setActiveTab('billing'); setSidebarOpen(false); }}
              id="sidebar-tab-billing"
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-xs font-semibold uppercase tracking-wider ${
                activeTab === 'billing' 
                  ? 'bg-gradient-to-r from-[rgba(0,209,255,0.1)] to-transparent text-[#E2E8F0] border-l-3 border-[#00D1FF] font-bold' 
                  : 'text-[#718096] hover:bg-[#15181F]/40 hover:text-[#E2E8F0]'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={15} />
                <span>POS Terminal</span>
              </div>
            </button>

          </nav>

        </div>

        {/* BOTTOM METADATA RAIL */}
        <div id="sidebar-footer" className="space-y-4">
          
          {/* Low Stock Warning Alert Strip if applicable */}
          {lowStockCount > 0 && (
            <div className="p-3 bg-[#15181F] border border-[#F56565]/20 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-[#F56565] font-bold tracking-tight">
                <AlertCircle size={13} />
                <span>Critical Stock Alerts</span>
              </div>
              <p className="text-[10px] text-[#718096] leading-normal font-medium">{lowStockCount} items require immediate restocking.</p>
            </div>
          )}

          {/* Sync Trigger Action */}
          <button 
            onClick={handleGlobalRefresh}
            className="w-full py-2 bg-[#15181F] hover:bg-[#1A1D24] text-[#718096] hover:text-[#E2E8F0] text-[11px] font-semibold border border-[#23272F] rounded-xl transition flex items-center justify-center gap-1.5 leading-none"
          >
            <RefreshCw size={11} className="text-[#00D1FF]" />
            Sync Hardware Nodes
          </button>

          {/* Cashier profile info */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-[#23272F] text-xs">
            <div className="w-8 h-8 rounded-full bg-[#15181F] border border-[#23272F] flex items-center justify-center shadow">
              <UserCheck size={14} className="text-[#48BB78]" />
            </div>
            <div>
              <p className="font-semibold text-[#E2E8F0]">Alex Cashier</p>
              <p className="text-[10px] text-[#718096]">Stratos Operator</p>
            </div>
          </div>

        </div>

      </aside>

      {/* OVERLAY BACKGROUND CLOAK FOR MOBILE SIDERAILS */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
        ></div>
      )}

      {/* MAIN CONTENT CANVAS PANEL */}
      <main className="flex-1 md:h-screen md:overflow-y-auto px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        
        {/* Dynamic Panel Mount */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            onNavigateToInventory={() => setActiveTab('inventory')}
            triggerRefresh={triggerRefresh}
            onRestocked={handleGlobalRefresh}
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory 
            triggerRefresh={triggerRefresh}
            onInventoryChanged={handleGlobalRefresh}
          />
        )}

        {activeTab === 'billing' && (
          <BillingTerminal 
            triggerRefresh={triggerRefresh}
            onCheckoutComplete={handleGlobalRefresh}
          />
        )}

      </main>

    </div>
  );
}
