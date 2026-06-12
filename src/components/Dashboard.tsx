import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  Percent, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { offlineApi } from '../offlineApi.ts';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';


// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardProps {
  onNavigateToInventory: () => void;
  triggerRefresh: boolean;
  onRestocked: () => void;
}

export default function Dashboard({ onNavigateToInventory, triggerRefresh, onRestocked }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Manual restock handling from Dashboard quick alert
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newStock, setNewStock] = useState<number>(50);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const data = await offlineApi.getDashboardAnalytics();
        
        if (data.success) {
          setMetrics(data.analytics);
          setIsUsingSupabase(data.isUsingSupabase || false);
          setSupabaseError(data.supabaseError || null);
          setError(null);
        } else {
          setError(data.message || 'Failed to fetch analytics');
        }
      } catch (err: any) {
        setError('Failed to connect to the backend server. Make sure the server is fully running.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [triggerRefresh, refreshCount]);

  const handleQuickRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      setUpdating(true);
      const data = await offlineApi.updateProduct(selectedProduct.id, { stock_quantity: newStock });
      if (data.success) {
        setSelectedProduct(null);
        onRestocked(); // Notify parent so stock matches everywhere
        setRefreshCount(prev => prev + 1); // Refresh dashboard analytics
      } else {
        alert(data.message || 'Failed to restock product');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to Server');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#718096] bg-[#0A0B0E]">
        <RefreshCw className="animate-spin mb-3 w-8 h-8 text-[#00D1FF]" />
        <p className="text-sm font-semibold uppercase tracking-wider font-mono">Optimizing Stratos nodes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#15181F] border border-[#F56565]/20 rounded-xl p-6 text-[#F56565] text-center">
        <AlertTriangle className="mx-auto text-[#F56565] mb-2" size={32} />
        <h3 className="font-bold text-lg mb-1 tracking-wider uppercase font-mono">Ledger Node Retrieval Failed</h3>
        <p className="text-sm opacity-90 max-w-md mx-auto">{error}</p>
        <button 
          onClick={() => setRefreshCount(prev => prev + 1)}
          className="mt-4 px-4 py-2 bg-[#F56565] hover:bg-[#F56565]/80 text-[#0A0B0E] rounded-lg text-xs font-bold uppercase tracking-wider transition leading-none inline-flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Re-establish Pipeline
        </button>
      </div>
    );
  }

  const { overview, salesTimeline, topSellingProducts, lowStockItems } = metrics;

  // Chart 1: Revenue & Profit Trend (Line)
  const lineChartData = {
    labels: salesTimeline.map((day: any) => day.formattedDate),
    datasets: [
      {
        label: 'Revenue ($)',
        data: salesTimeline.map((day: any) => day.revenue),
        borderColor: '#00D1FF', // Brand Cyan
        backgroundColor: 'rgba(0, 209, 255, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#00D1FF',
        pointHoverRadius: 6,
      },
      {
        label: 'Net Profit ($)',
        data: salesTimeline.map((day: any) => day.profit),
        borderColor: '#48BB78', // Stratos Green
        backgroundColor: 'rgba(72, 187, 120, 0.04)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        borderDash: [5, 4],
        pointBackgroundColor: '#48BB78',
        pointHoverRadius: 6,
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: { family: "'Courier New', monospace", size: 11, weight: 600 as any },
          color: '#A0AEC0'
        }
      },
      tooltip: {
        backgroundGradient: 'linear',
        padding: 12,
        bodySpacing: 8,
        titleFont: { size: 13, weight: 700 as any },
        bodyFont: { size: 12 },
        callbacks: {
          label: function(context: any) {
            return ` ${context.dataset.label.split(' (')[0]}: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718096', font: { family: "'Courier New', monospace", size: 11 } }
      },
      y: {
        grid: { color: '#23272F' },
        ticks: { color: '#718096', font: { family: "'Courier New', monospace", size: 11 } },
        border: { dash: [4, 4] }
      }
    }
  };

  // Chart 2: Top Selling Products (Bar)
  const barChartData = {
    labels: topSellingProducts.map((p: any) => p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name),
    datasets: [
      {
        label: 'Units Sold',
        data: topSellingProducts.map((p: any) => p.quantity),
        backgroundColor: '#00D1FF', // Neon Cyan
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 32,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: 12,
        callbacks: {
          label: function(context: any) {
            const prod = topSellingProducts[context.dataIndex];
            return ` Sold: ${context.raw} units | Rev: $${prod.revenue.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718096', font: { family: "'Courier New', monospace", size: 11 } }
      },
      y: {
        grid: { color: '#23272F' },
        ticks: { color: '#718096', precision: 0, font: { family: "'Courier New', monospace", size: 11 } },
        border: { dash: [4, 4] }
      }
    }
  };

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* SECTION 1: HEADER & CONNECTION MODE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#15181F] border border-[#23272F] rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#E2E8F0] uppercase tracking-wider font-mono">Performance Analytics</h2>
          <p className="text-xs text-[#718096] mt-1">Real-time status of connected physical ledger nodes and financial streams.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-[#48BB78]/10 text-[#48BB78] text-xs font-semibold rounded-full border border-[#48BB78]/20 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#48BB78] animate-pulse"></span>
            Stratos Node Active
          </span>
          {isUsingSupabase ? (
            <span className="px-3 py-1 bg-[#00D1FF]/10 text-[#00D1FF] text-xs font-semibold rounded-full border border-[#00D1FF]/20 shadow-xs">
              Supabase Connected
            </span>
          ) : supabaseError ? (
            <span className="px-3 py-1 bg-[#F56565]/10 text-[#F56565] text-xs font-semibold rounded-full border border-[#F56565]/20 shadow-xs cursor-help" title={`Supabase failed to initialize or load tables (Error: ${supabaseError}). Operational failover has reverted to Sandbox Ledger mode.`}>
              Sandbox Failover Active (DB Error)
            </span>
          ) : (
            <span className="px-3 py-1 bg-[#F6AD55]/10 text-[#F6AD55] text-xs font-semibold rounded-full border border-[#F6AD55]/20 shadow-xs" title="Provide Supabase credentials in env options to hook into live cloud database.">
              Sandbox Ledger
            </span>
          )}
        </div>
      </div>

      {/* SECTION 2: METRIC SUMMARIES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: Total Revenue */}
        <div id="stat-revenue" className="relative overflow-hidden bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#718096] uppercase tracking-wider">Total Sales</p>
            <p className="text-2xl font-bold text-[#E2E8F0] font-mono tracking-tight">${overview.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#48BB78]">
              <TrendingUp size={12} />
              <span>Optimized Flow</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-[#111318] text-[#00D1FF] rounded-xl flex items-center justify-center border border-[#23272F]">
            <DollarSign size={22} className="stroke-[2.5]" />
          </div>
        </div>

        {/* CARD 2: Net Profit Margin */}
        <div id="stat-profit" className="relative overflow-hidden bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#718096] uppercase tracking-wider">Net Profit margin</p>
            <p className="text-2xl font-bold text-[#E2E8F0] font-mono tracking-tight">
              {overview.profitMargin.toFixed(2)}%
            </p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#48BB78]">
              <span className="font-mono">Est: ${overview.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-[#111318] text-[#48BB78] rounded-xl flex items-center justify-center border border-[#23272F]">
            <Percent size={20} className="stroke-[2.5]" />
          </div>
        </div>

        {/* CARD 3: Active SKUs */}
        <div id="stat-skus" className="relative overflow-hidden bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#718096] uppercase tracking-wider">Active Catalog SKUs</p>
            <p className="text-2xl font-bold text-[#E2E8F0] font-mono tracking-tight">{overview.totalActiveSkus}</p>
            <p className="text-[11px] text-[#718096] font-medium font-mono">Val: ${overview.totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="w-12 h-12 bg-[#111318] text-[#00D1FF] rounded-xl flex items-center justify-center border border-[#23272F]">
            <Layers size={20} className="stroke-[2.5]" />
          </div>
        </div>

        {/* CARD 4: Low Stock Alerts */}
        <div id="stat-low-stock" className="relative overflow-hidden bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#718096] uppercase tracking-wider">Low Stock alerts</p>
            <p className="text-2xl font-bold text-[#E2E8F0] font-mono tracking-tight">{overview.activeLowStockAlerts}</p>
            {overview.activeLowStockAlerts > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F56565] bg-[#F56565]/10 px-2 py-0.5 rounded border border-[#F56565]/20">
                <AlertTriangle size={10} /> Needs Restock
              </span>
            ) : (
              <span className="text-[11px] text-[#48BB78] font-semibold">Warehouse Healthy</span>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
            overview.activeLowStockAlerts > 0 
              ? 'bg-[#111318] text-[#F56565] border-[#F56565]/30 animate-pulse' 
              : 'bg-[#111318] text-[#718096] border-[#23272F]'
          }`}>
            <AlertTriangle size={20} className="stroke-[2.2]" />
          </div>
        </div>

      </div>

      {/* SECTION 3: VISUALIZERS (LINE GRAPH & BAR CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LINE CHART: Daily Revenues and profits */}
        <div className="lg:col-span-3 bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#23272F] pb-3">
            <div>
              <h3 className="font-bold text-[#A0AEC0] text-sm uppercase tracking-wider">Revenue flow (30 Days)</h3>
              <p className="text-[11px] text-[#718096]">Gross revenue plotted against net profits over daily intervals.</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#00D1FF]"></span>Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-dashed border-[#48BB78] rounded-full bg-transparent"></span>Net profit</span>
            </div>
          </div>
          <div className="h-64 relative">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* BAR CHART: TOP PRODUCTS */}
        <div className="lg:col-span-2 bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs">
          <div className="mb-4 border-b border-[#23272F] pb-3">
            <h3 className="font-bold text-[#A0AEC0] text-sm uppercase tracking-wider font-sans">High-Velocity Items</h3>
            <p className="text-[11px] text-[#718096]">Fastest moving products by total volume sold.</p>
          </div>
          <div className="h-64 relative">
            {topSellingProducts.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-[#718096] font-mono">
                No active sales registered. Run checkout invoices first!
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SECTION 4: IMMEDIATE LOW-STOCK HEALTH DIAGNOSTIC PANEL */}
      <div className="bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#23272F] pb-3 mb-4 gap-3">
          <div>
            <h3 className="font-bold text-[#A0AEC0] text-sm uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F56565]" />
              Warehouse Low-Stock Thresholds
            </h3>
            <p className="text-[11px] text-[#718096]">Expedite catalog stock replenishments to avoid user purchase disruptions.</p>
          </div>
          <button 
            type="button"
            onClick={onNavigateToInventory}
            className="flex items-center gap-1.5 text-xs text-[#00D1FF] hover:text-[#00D1FF]/80 font-bold tracking-wider uppercase bg-[#00D1FF]/10 px-3 py-1.5 rounded-lg border border-[#00D1FF]/20"
          >
            Product Catalog <ArrowRight size={13} className="stroke-[2.5]" />
          </button>
        </div>

        {lowStockItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#23272F] text-[11px] uppercase tracking-wider font-semibold text-[#718096] bg-[#111318]">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU Identifier</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Alarm Limit</th>
                  <th className="py-2.5 px-3 text-center">Procurement action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-[#1A1D24] hover:bg-[#1A1D24]/40 text-xs">
                    <td className="py-3 px-3 font-semibold text-[#E2E8F0]">{item.name}</td>
                    <td className="py-3 px-3">
                      <code className="px-1.5 py-0.5 bg-[#0A0B0E] text-[#00D1FF] border border-[#23272F] rounded text-[10px] font-mono">
                        {item.sku}
                      </code>
                    </td>
                    <td className="py-3 px-3 text-right text-[#F56565] font-mono font-bold tracking-tight">{item.stock_quantity} units</td>
                    <td className="py-3 px-3 text-right text-[#718096] font-mono">{item.low_stock_threshold} units</td>
                    <td className="py-3 px-3 text-center">
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedProduct(item);
                          setNewStock(item.stock_quantity + 50); // Direct suggestion
                        }}
                        className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 text-[#48BB78] bg-[#48BB78]/10 hover:bg-[#48BB78]/20 border border-[#48BB78]/30 rounded-md transition duration-150 leading-none"
                      >
                        Replenish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#718096] font-mono">
            All warehouse nodes sit comfortably above alert lines.
          </div>
        )}
      </div>

      {/* QUICK INSTANT REPLENISH MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-[#0A0B0E]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#15181F] border border-[#23272F] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#23272F] bg-[#111318]">
              <h4 className="font-bold text-sm text-[#E2E8F0] font-mono uppercase tracking-wider">Emergency stock lock</h4>
              <p className="text-[11px] text-[#718096] mt-0.5">Increment levels for <strong>{selectedProduct.name}</strong> instantly.</p>
            </div>
            <form onSubmit={handleQuickRestock} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#718096] uppercase mb-1">New Total Stock Level</label>
                <input 
                  type="number"
                  min="0"
                  required
                  value={newStock}
                  onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                  className="w-full text-[#E2E8F0] bg-[#0A0B0E] text-sm px-3.5 py-2 border border-[#23272F] rounded-lg focus:outline-none focus:border-[#00D1FF] font-mono"
                />
                <p className="text-[10px] text-[#718096] mt-1 font-mono">Previous: {selectedProduct.stock_quantity}. Lock in +{Math.max(0, newStock - selectedProduct.stock_quantity)} units.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#23272F] text-xs font-semibold">
                <button 
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-3.5 py-2 text-[#718096] hover:bg-[#111318] rounded-lg leading-none"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={updating}
                  className="px-3.5 py-2 bg-[#48BB78] hover:bg-[#38A169] text-[#0A0B0E] font-bold uppercase tracking-wider rounded-lg leading-none shadow-sm flex items-center justify-center transition"
                >
                  {updating ? 'Saving...' : 'Lock Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
