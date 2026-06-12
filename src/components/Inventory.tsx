import { type FormEvent, useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  RefreshCw,
  X,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  price: number;
  cost_price: number;
  created_at?: string;
}

interface InventoryProps {
  triggerRefresh: boolean;
  onInventoryChanged: () => void;
}

export default function Inventory({ triggerRefresh, onInventoryChanged }: InventoryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock_quantity' | 'price' | 'sku'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Forms State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newThreshold, setNewThreshold] = useState('5');
  const [newPrice, setNewPrice] = useState('19.99');
  const [newCost, setNewCost] = useState('10.00');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch inventory catalog');
      }
    } catch (err: any) {
      setError('Could not connect to service. Ensure the server is online.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [triggerRefresh]);

  const handleOpenAdd = () => {
    setNewName('');
    setNewSku('');
    setNewStock('25');
    setNewThreshold('5');
    setNewPrice('29.99');
    setNewCost('12.50');
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setSelectedProduct(p);
    setNewName(p.name);
    setNewSku(p.sku);
    setNewStock(p.stock_quantity.toString());
    setNewThreshold(p.low_stock_threshold.toString());
    setNewPrice(p.price.toString());
    setNewCost(p.cost_price.toString());
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName || !newSku) {
      setFormError('Name and SKU code are strictly required');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          stock_quantity: parseInt(newStock),
          low_stock_threshold: parseInt(newThreshold),
          price: parseFloat(newPrice),
          cost_price: parseFloat(newCost)
        })
      });
      const data = await res.json();

      if (data.success) {
        setIsAddOpen(false);
        fetchInventory();
        onInventoryChanged(); // Update other tabs
      } else {
        setFormError(data.message || 'Error creating product');
      }
    } catch (err) {
      setFormError('Failed to establish server transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch(`/api/inventory/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          stock_quantity: parseInt(newStock),
          low_stock_threshold: parseInt(newThreshold),
          price: parseFloat(newPrice),
          cost_price: parseFloat(newCost)
        })
      });
      const data = await res.json();

      if (data.success) {
        setIsEditOpen(false);
        setSelectedProduct(null);
        fetchInventory();
        onInventoryChanged(); // Update other tabs
      } else {
        setFormError(data.message || 'Error saving product');
      }
    } catch (err) {
      setFormError('Failed to establish server transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to completely delete "${name}" from the active database? This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchInventory();
        onInventoryChanged();
      } else {
        alert(data.message || 'Failed to remove product');
      }
    } catch (err) {
      alert('Error deleting product');
    }
  };

  // Filter & Sort math
  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
    const isLow = p.stock_quantity <= p.low_stock_threshold;
    
    if (stockFilter === 'low') return matchesSearch && isLow;
    if (stockFilter === 'healthy') return matchesSearch && !isLow;
    return matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let selectA: any = a[sortBy];
    let selectB: any = b[sortBy];

    if (typeof selectA === 'string') {
      return sortOrder === 'asc' 
        ? selectA.localeCompare(selectB) 
        : selectB.localeCompare(selectA);
    } else {
      return sortOrder === 'asc' 
        ? (selectA - selectB) 
        : (selectB - selectA);
    }
  });

  const toggleSort = (field: 'name' | 'stock_quantity' | 'price' | 'sku') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div id="inventory-tab" className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#15181F] border border-[#23272F] rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#E2E8F0] uppercase tracking-wider font-mono">Product Catalog</h2>
          <p className="text-xs text-[#718096] mt-1">Configure retail products, trace unique SKUs, set warning limit thresholds, and restock manual rows.</p>
        </div>
        <button 
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-[#0A0B0E] rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition duration-150 border border-[#00D1FF]/30 cursor-pointer"
        >
          <Plus size={16} className="stroke-[2.5]" />
          Create New Product
        </button>
      </div>

      {/* FILTER & SEARCH PANEL */}
      <div className="bg-[#15181F] border border-[#23272F] rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        
        {/* Search Input */}
        <div className="relative md:col-span-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718096]" />
          <input 
            type="text"
            placeholder="Search products by SKU identifier or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] text-xs pl-10 pr-4 py-2.5 border border-[#23272F] focus:border-[#00D1FF] hover:border-[#2D3748] focus:outline-none rounded-xl font-sans"
          />
        </div>

        {/* Stock Alert Filter */}
        <div className="flex items-center gap-1.5 md:col-span-4 justify-start md:justify-center">
          <span className="text-[11px] font-bold text-[#718096] uppercase tracking-wider">Stock Filter:</span>
          <div className="inline-flex rounded-lg border border-[#23272F] bg-[#0A0B0E] p-0.5 text-xs">
            <button 
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition ${stockFilter === 'all' ? 'bg-[#15181F] text-[#E2E8F0]' : 'text-[#718096] hover:text-[#E2E8F0]'}`}
            >
              All ({products.length})
            </button>
            <button 
              type="button"
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1 transition ${stockFilter === 'low' ? 'bg-[#F56565]/10 text-[#F56565]' : 'text-[#718096] hover:text-[#E2E8F0]'}`}
            >
              Low ({products.filter(p => p.stock_quantity <= p.low_stock_threshold).length})
            </button>
          </div>
        </div>

        {/* Total stats panel */}
        <div className="md:col-span-3 flex justify-end text-xs text-[#718096] font-semibold whitespace-nowrap bg-[#0A0B0E] border border-[#23272F] px-3 py-2 rounded-xl">
          Filtered: {sortedProducts.length} of {products.length} units
        </div>

      </div>

      {/* INVENTORY CATALOG TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-[#718096] bg-[#15181F] border border-[#23272F] rounded-2xl">
          <RefreshCw className="animate-spin mb-3 w-8 h-8 text-[#00D1FF]" />
          <p className="text-xs font-semibold uppercase tracking-wider font-mono">Syncing database inventory records...</p>
        </div>
      ) : error ? (
        <div className="bg-[#15181F] border border-[#F56565]/20 rounded-2xl p-8 text-center text-[#F56565]">
          <AlertTriangle size={32} className="mx-auto mb-2 text-[#F56565]" />
          <h4 className="font-bold text-base uppercase font-mono tracking-wider">Server Retrieval Error</h4>
          <p className="text-xs opacity-90 max-w-sm mx-auto mt-1">{error}</p>
        </div>
      ) : (
        <div className="bg-[#15181F] border border-[#23272F] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-[#23272F] bg-[#111318] text-[11px] font-bold text-[#718096] uppercase tracking-widest">
                  <th onClick={() => toggleSort('name')} className="py-4 px-4 cursor-pointer hover:bg-[#1A1D24] hover:text-[#E2E8F0] transition">
                    <span className="flex items-center gap-1">Product Details {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}</span>
                  </th>
                  <th onClick={() => toggleSort('sku')} className="py-4 px-4 cursor-pointer hover:bg-[#1A1D24] hover:text-[#E2E8F0] transition w-32">
                    <span className="flex items-center gap-1 font-mono">SKU ID {sortBy === 'sku' && (sortOrder === 'asc' ? '▲' : '▼')}</span>
                  </th>
                  <th onClick={() => toggleSort('stock_quantity')} className="py-4 px-4 cursor-pointer hover:bg-[#1A1D24] hover:text-[#E2E8F0] transition text-right w-28">
                    <span className="flex items-center gap-1 justify-end">Stock {sortBy === 'stock_quantity' && (sortOrder === 'asc' ? '▲' : '▼')}</span>
                  </th>
                  <th className="py-4 px-4 text-right w-24">Alert Line</th>
                  <th onClick={() => toggleSort('price')} className="py-4 px-4 cursor-pointer hover:bg-[#1A1D24] hover:text-[#E2E8F0] transition text-right w-28">
                    <span className="flex items-center gap-1 justify-end">Unit Price {sortBy === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}</span>
                  </th>
                  <th className="py-4 px-4 text-right w-28">Cost Price</th>
                  <th className="py-4 px-4 text-center w-32 border-[#23272F]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23272F]">
                {sortedProducts.length > 0 ? (
                  sortedProducts.map((p) => {
                    const isLow = p.stock_quantity <= p.low_stock_threshold;
                    return (
                      <tr 
                        key={p.id} 
                        id={`product-${p.id}`}
                        className={`transition duration-150 hover:bg-[#1A1D24]/30 ${isLow ? 'bg-[#F56565]/5' : ''}`}
                      >
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className={`text-[13px] font-bold leading-tight ${isLow ? 'text-[#F56565]' : 'text-[#E2E8F0]'}`}>{p.name}</span>
                            {isLow && (
                              <span className="text-[10px] text-[#F56565] font-bold tracking-tight inline-flex items-center gap-0.5 mt-0.5 animate-pulse">
                                <AlertTriangle size={10} /> Critical Replenishment Warning
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#718096]">
                          <code className="px-1.5 py-0.5 bg-[#0A0B0E] border border-[#23272F] rounded text-[#00D1FF] font-semibold">{p.sku}</code>
                        </td>

                        {/* Stock Quantity */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`text-[13px] font-mono font-bold tracking-wider ${isLow ? 'text-[#F56565]' : 'text-[#E2E8F0]'}`}>
                            {p.stock_quantity.toLocaleString()}
                          </span>
                        </td>

                        {/* Low threshold limit */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-[#718096]">
                          {p.low_stock_threshold}
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-4 text-right font-mono text-[13px] font-bold text-[#E2E8F0]">
                          ${Number(p.price).toFixed(2)}
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3.5 px-4 text-right font-mono text-[13px] text-[#718096]">
                          ${Number(p.cost_price).toFixed(2)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center gap-1 text-xs">
                            <button 
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="p-1 px-2 text-[#00D1FF] hover:bg-[#00D1FF]/10 border border-[#23272F] rounded-md shadow-3xs flex items-center gap-1 font-semibold transition"
                            >
                              <Edit3 size={11} /> Edit
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1 text-[#F56565] hover:bg-[#F56565]/15 border border-[#23272F] rounded-md shadow-3xs transition"
                              title="Delete Item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#718096] font-mono text-xs">
                      No products match your current filtering layouts. RESET tags!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD DIALOG MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-[#0A0B0E]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#15181F] border border-[#23272F] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-[#23272F] bg-[#111318]">
              <div>
                <h4 className="font-bold text-[#E2E8F0] text-sm uppercase tracking-wider font-mono">Register Catalog SKU</h4>
                <p className="text-[11px] text-[#718096]">Must map distinct costing metrics for accurate net revenue graphs.</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-[#718096] hover:text-[#E2E8F0] transition cursor-pointer"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-[#F56565]/10 border border-[#F56565]/20 text-[#F56565] text-xs rounded-xl flex items-center gap-1.5 font-bold font-mono uppercase">
                  <AlertTriangle size={14} className="text-[#F56565]" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Product Name</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mechanical Backlit Keyboard"
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Unique SKU Code</label>
                  <input 
                    type="text" 
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    placeholder="e.g. MCH-KEY-005"
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl uppercase"
                  />
                </div>

                {/* Sell Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Retail Shelf Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="29.99"
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Acquisition Cost Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="12.50"
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Stock Beginning */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Initial stock level</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Alarm Threshold */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Low stock alert limit</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#23272F] text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2.5 text-[#718096] hover:bg-[#111318] rounded-xl transition cursor-pointer"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-[#0A0B0E] font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center border border-[#00D1FF]/20 shadow-sm cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Authorize Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / REPLENISH LEVEL DIALOG MODAL */}
      {isEditOpen && selectedProduct && (
        <div className="fixed inset-0 bg-[#0A0B0E]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#15181F] border border-[#23272F] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-[#23272F] bg-[#111318]">
              <div>
                <h4 className="font-bold text-[#E2E8F0] text-sm uppercase tracking-wider font-mono">Modify Catalog Unit</h4>
                <p className="text-[11px] text-[#718096]">Edit ledger metrics for <strong>{selectedProduct.name}</strong></p>
              </div>
              <button onClick={() => { setIsEditOpen(false); setSelectedProduct(null); }} className="text-[#718096] hover:text-[#E2E8F0] transition cursor-pointer"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleEditProduct} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-[#F56565]/10 border border-[#F56565]/20 text-[#F56565] text-xs rounded-xl flex items-center gap-1.5 font-bold font-mono uppercase">
                  <AlertTriangle size={14} className="text-[#F56565]" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Product Name</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">SKU Tag</label>
                  <input 
                    type="text" 
                    required
                    value={newSku}
                    disabled // Uniqueness SKU index standard protection on edit keys
                    className="w-full text-[#718096] bg-[#111318] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] rounded-xl cursor-not-allowed uppercase"
                    title="SKU identities once logged are un-editable to preserve ledger consistency."
                  />
                </div>

                {/* Sell Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Retail Shelf Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Acquisition Cost Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Stock Level */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Current Stock Quantity</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>

                {/* Alarm Threshold */}
                <div>
                  <label className="block text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-1">Low Stock Alert threshold</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="w-full text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs px-3.5 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#23272F] text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => { setIsEditOpen(false); setSelectedProduct(null); }}
                  className="px-4 py-2.5 text-[#718096] hover:bg-[#111318] rounded-xl transition cursor-pointer"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-[#0A0B0E] font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center border border-[#00D1FF]/20 shadow-sm cursor-pointer"
                >
                  {saving ? 'Updating...' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
