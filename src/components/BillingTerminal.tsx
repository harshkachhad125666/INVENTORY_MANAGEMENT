import { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Minus, 
  Plus, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles,
  X,
  RefreshCw
} from 'lucide-react';
import { offlineApi } from '../offlineApi.ts';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  price: number;
  cost_price: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface BillingTerminalProps {
  triggerRefresh: boolean;
  onCheckoutComplete: () => void;
}

export default function BillingTerminal({ triggerRefresh, onCheckoutComplete }: BillingTerminalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [search, setSearch] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);

  // Checkout response
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const data = await offlineApi.getInventory();
      if (data.success) {
        setProducts(data.products || []);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch catalog products');
      }
    } catch (err) {
      setError('Could not connect to service host.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [triggerRefresh]);

  // Add item to shopping cart
  const handleAddToCart = (product: Product) => {
    if (product.stock_quantity <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      
      if (existing) {
        // Enforce stock bounds
        if (existing.quantity >= product.stock_quantity) {
          alert(`Cannot purchase more units than are available in stock (${product.stock_quantity} available).`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const prod = products.find(p => p.id === productId)!;

    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > prod.stock_quantity) {
            alert(`Requested quantity exceeds current stock level (${prod.stock_quantity} available).`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Math totals
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.product.price), 0);
  const taxRate = 0.10; // Fixed 10% tax
  const taxAmount = parseFloat((subtotal * taxRate).toFixed(2));
  
  // Safe limit discount deduction to not drop total below negative
  const safeDiscount = Math.min(discount, subtotal + taxAmount);
  const grandTotal = parseFloat((subtotal + taxAmount - safeDiscount).toFixed(2));

  // Handle Checkout invoice transaction
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Build unique invoice number: INV-YEARMODAY-HOURMINSEC-RAND
    const now = new Date();
    const pad = (v: number) => v.toString().padStart(2, '0');
    const invoiceNumber = `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const payload = {
      invoice_number: invoiceNumber,
      total_amount: grandTotal,
      tax_amount: taxAmount,
      discount: safeDiscount,
      cashier_id: null, // Let server profile defaults handle,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price
      }))
    };

    try {
      setSubmitting(true);
      const data = await offlineApi.createInvoice(payload);

      if (data.success) {
        // Prepare beautiful receipt modal
        setReceiptDetails({
          invoice_number: invoiceNumber,
          timestamp: now.toISOString(),
          cashier_name: 'Alex Cashier',
          items: [...cart],
          subtotal,
          taxAmount,
          discount: safeDiscount,
          grandTotal
        });
        
        // Reset local cart states immediately
        setCart([]);
        setDiscount(0);
        setIsReceiptOpen(true);

        // Fetch refreshed quantities and trigger outer triggers
        fetchCatalog();
        onCheckoutComplete();
      } else {
        alert(data.message || 'Transaction could not be completed.');
      }
    } catch (err) {
      console.error(err);
      alert('Network failure processing checkout database transactions.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
  });

  return (
    <div id="billing-terminal-tab" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-130px)] min-h-[550px]">
      
      {/* LEFT COLUMN: PRODUCT GRID (Col Span 7) */}
      <div className="lg:col-span-7 flex flex-col bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-sm overflow-hidden h-full">
        
        {/* CATALOG HEADER */}
        <div className="mb-4">
          <h2 className="text-sm font-bold text-[#E2E8F0] uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Terminal Catalog Select</span>
            <span className="text-[10px] bg-[#00D1FF]/10 border border-[#00D1FF]/20 px-2 py-0.5 rounded-full text-[#00D1FF] font-bold lowercase">
              {filteredProducts.length} items catalogued
            </span>
          </h2>
          {/* Quick Search */}
          <div className="relative mt-2.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718096]" size={15} />
            <input 
              type="text" 
              placeholder="Search items by SKU code or name identifier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[#E2E8F0] bg-[#0A0B0E] placeholder-[#718096] text-xs pl-10 pr-4 py-2.5 border border-[#23272F] focus:border-[#00D1FF] focus:outline-none rounded-xl"
            />
          </div>
        </div>

        {/* PRODUCTS GRID CONTAINER */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#718096]">
            <RefreshCw className="animate-spin w-8 h-8 mb-2 text-[#00D1FF]" />
            <p className="text-xs font-semibold uppercase tracking-wider font-mono">Syncing Terminal Catalog...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#F56565] text-center">
            <AlertTriangle className="mb-1 text-[#F56565]" size={24} />
            <span className="text-xs font-semibold font-mono">{error}</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 select-none">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => {
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                const cartQty = cart.find(it => it.product.id === p.id)?.quantity || 0;
                
                return (
                  <div 
                    key={p.id}
                    id={`pos-item-${p.id}`}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    className={`relative overflow-hidden group border rounded-2xl p-3.5 flex flex-col justify-between transition text-left cursor-pointer ${
                      isOutOfStock 
                        ? 'bg-[#0A0B0E]/40 border-[#23272F] opacity-40 cursor-not-allowed' 
                        : isLowStock 
                        ? 'bg-[#111318] border-[#F56565]/35 hover:bg-[#1A1D24]/40 hover:border-[#F56565]/60 shadow-2xs' 
                        : 'bg-[#111318] border-[#23272F] hover:bg-[#1A1D24]/40 hover:border-[#00D1FF]/40 shadow-2xs'
                    }`}
                  >
                    {/* Upper badge quantities */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <code className="text-[10px] font-semibold text-[#718096] font-mono tracking-tight">{p.sku}</code>
                      {cartQty > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00D1FF] text-[#0A0B0E] shadow-xs">
                          {cartQty} lock
                        </span>
                      )}
                    </div>

                    {/* Produc Name */}
                    <h3 className={`text-[12.5px] font-bold tracking-tight line-clamp-2 leading-snug flex-1 ${isOutOfStock ? 'text-[#718096]' : 'text-[#E2E8F0]'}`}>
                      {p.name}
                    </h3>

                    {/* Stock level indicators / Prices */}
                    <div className="flex items-end justify-between mt-4">
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-[#F56565] bg-[#F56565]/10 border border-[#F56565]/20 px-1.5 py-0.5 rounded uppercase">
                          Depleted
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[10px] font-bold text-[#F56565] bg-[#F56565]/10 border border-[#F56565]/20 px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                          Only {p.stock_quantity} unit left
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#718096] font-mono">
                          Stock: {p.stock_quantity}
                        </span>
                      )}
                      
                      <span className={`text-sm font-bold font-mono tracking-tight ${isOutOfStock ? 'text-[#718096]' : 'text-[#00D1FF] px-1'}`}>
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 text-center text-[#718096] font-mono text-xs py-12">
                No catalog entries match your active searching.
              </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: ACTIVE SHOPPING CART AND BILLINGS CHECKOUT (Col Span 5) */}
      <div className="lg:col-span-5 flex flex-col bg-[#15181F] border border-[#23272F] rounded-2xl p-5 shadow-sm overflow-hidden h-full font-sans">
        
        {/* CHECKOUT CART HEADER */}
        <div className="flex items-center justify-between border-b border-[#23272F] pb-3 mb-3">
          <h2 className="text-sm font-bold text-[#E2E8F0] uppercase tracking-wider font-mono flex items-center gap-1.5">
            <ShoppingCart size={16} className="text-[#00D1FF]" />
            Active Sales Cart
          </h2>
          <button 
            type="button"
            className="text-[10px] font-extrabold uppercase tracking-wider bg-[#F56565]/10 hover:bg-[#F56565]/15 text-[#F56565] border border-[#F56565]/20 px-2 py-1 rounded-md transition duration-150 cursor-pointer"
            onClick={() => setCart([])}
            disabled={cart.length === 0}
          >
            Reset
          </button>
        </div>

        {/* CART ITEMS CONTAINER */}
        <div className="flex-1 overflow-y-auto pr-1 select-none space-y-2 mb-4">
          {cart.length > 0 ? (
            cart.map((item) => (
              <div 
                key={item.product.id}
                id={`cart-item-${item.product.id}`}
                className="flex items-center justify-between gap-3 p-3 bg-[#111318] rounded-xl border border-[#23272F] text-xs hover:border-[#00D1FF]/30 transition"
              >
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[#E2E8F0] truncate">{item.product.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-[#718096] leading-none">{item.product.sku}</span>
                    <span className="text-[10px] text-[#00D1FF] leading-none font-bold font-mono">@ ${item.product.price.toFixed(2)}</span>
                  </div>
                </div>

                {/* Arithmetic Controls */}
                <div className="flex items-center gap-1.5 bg-[#0A0B0E] border border-[#23272F] rounded-lg p-0.5 shadow-2xs">
                  <button 
                    type="button"
                    onClick={() => handleUpdateQuantity(item.product.id, -1)}
                    className="p-1 text-[#718096] hover:text-[#00D1FF] hover:bg-[#111318] rounded transition"
                  >
                    <Minus size={11} className="stroke-[3]" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-xs text-[#E2E8F0] select-none">
                    {item.quantity}
                  </span>
                  <button 
                    type="button"
                    onClick={() => handleUpdateQuantity(item.product.id, 1)}
                    className="p-1 text-[#718096] hover:text-[#00D1FF] hover:bg-[#111318] rounded transition"
                  >
                    <Plus size={11} className="stroke-[3]" />
                  </button>
                </div>

                {/* Sub Total item */}
                <div className="text-right w-16 font-mono font-bold text-[#00D1FF] text-xs">
                  ${(item.quantity * item.product.price).toFixed(2)}
                </div>

                {/* Remove button */}
                <button 
                  type="button" 
                  onClick={() => handleRemoveItem(item.product.id)}
                  className="p-1 text-[#718096] hover:text-[#F56565] rounded transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#718096] text-center gap-2">
              <ShoppingCart size={32} className="stroke-[1.5] text-[#718096]/60" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#718096]">Cart is Empty</p>
                <p className="text-[10px] text-[#718096]/85 max-w-[180px] mx-auto mt-0.5">Click catalog items on the left to add them to this sales session cart.</p>
              </div>
            </div>
          )}
        </div>

        {/* BILLINGS CALCULATION FOOTER PANEL */}
        <div className="border-t border-[#23272F] pt-4 space-y-3">
          
          {/* Subtotal */}
          <div className="flex items-center justify-between text-xs text-[#718096] font-semibold font-mono">
            <span>Sub-total basket</span>
            <span className="text-[#E2E8F0]">${subtotal.toFixed(2)}</span>
          </div>

          {/* Tax math */}
          <div className="flex items-center justify-between text-xs text-[#718096] font-semibold font-mono">
            <span className="flex items-center gap-1">Sales Tax <strong className="text-[10px] font-extrabold text-[#718096] bg-[#0A0B0E] border border-[#23272F] rounded px-1">10%</strong></span>
            <span className="text-[#E2E8F0]">${taxAmount.toFixed(2)}</span>
          </div>

          {/* Discount deduction input */}
          <div className="flex items-center justify-between gap-4 text-xs font-semibold">
            <span className="text-[#718096] flex items-center gap-0.5 font-mono">Deduction Discount ($)</span>
            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#718096] font-bold">$</span>
              <input 
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount === 0 ? '' : discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-right text-[#E2E8F0] bg-[#0A0B0E] font-mono text-xs pl-5 pr-2.5 py-1.5 border border-[#23272F] outline-none focus:border-[#00D1FF] rounded-lg"
              />
            </div>
          </div>

          {/* GRAND PAYABLE VALUE */}
          <div className="border-t border-dashed border-[#23272F] pt-3 flex items-center justify-between">
            <span className="text-sm font-bold text-[#E2E8F0] uppercase tracking-wider font-mono">Payable Total</span>
            <span className="text-xl font-extrabold font-mono text-[#00D1FF] tracking-tight" id="terminal-grand-total">
              ${grandTotal.toFixed(2)}
            </span>
          </div>

          {/* CHECKOUT SLIDER BUTTON */}
          <button 
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition duration-150 flex items-center justify-center gap-1.5 leading-none cursor-pointer ${
              cart.length === 0 
                ? 'bg-[#111318] text-[#718096] border border-[#23272F] cursor-not-allowed' 
                : 'bg-[#48BB78] hover:bg-[#38A169] text-[#0A0B0E] border border-[#48BB78]/40 shadow-sm'
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw className="animate-spin" size={14} /> Authorizing ledger lock...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Commit & print invoice receipt
              </>
            )}
          </button>

        </div>

      </div>

      {/* POS THERMAL RECEIPT DIALOG MODAL */}
      {isReceiptOpen && receiptDetails && (
        <div className="fixed inset-0 bg-[#0A0B0E]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#15181F] border border-[#23272F] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
            
            {/* Modal Heading Controls */}
            <div className="flex items-center justify-between p-4 border-b border-[#23272F] bg-[#111318] select-none">
              <h4 className="font-bold text-xs text-[#718096] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <CheckCircle size={14} className="text-[#48BB78]" />
                Transaction Authorized (Safeguarded)
              </h4>
              <button onClick={() => setIsReceiptOpen(false)} className="text-[#718096] hover:text-[#E2E8F0] transition cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* RECEIPT RETAIL PAPER EMBED */}
            <div className="p-5 overflow-y-auto flex-1 h-96 select-text text-[#E2E8F0] leading-snug tracking-normal text-left font-mono max-w-md mx-auto" id="pos-thermal-receipt">
              <div className="border border-[#23272F] bg-[#0A0B0E] p-5 rounded-xl shadow-inner relative overflow-hidden">
                
                {/* Thermal paper top border line decorative spacer */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#23272F_4px,#23272F_8px)]"></div>
                
                {/* Header */}
                <div className="text-center space-y-1 pt-2 pb-4 border-b border-dashed border-[#23272F]">
                  <h3 className="font-bold text-[13px] uppercase tracking-wider text-[#00D1FF]">STRATOS LEDGER CO</h3>
                  <p className="text-[10px] text-[#718096]">100 GLO-RUNWAY PARKWAY, SECURE NODE 7</p>
                  <p className="text-[10px] text-[#718096]/70">CRYPTO-SYS SECURE INDEX</p>
                </div>

                {/* Metadata details */}
                <div className="py-3 border-b border-dashed border-[#23272F] text-[10px] space-y-1.5 text-[#718096]">
                  <div className="flex justify-between">
                    <span>INVOICE INDEX:</span>
                    <strong className="text-[#E2E8F0]">{receiptDetails.invoice_number}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>TIMELOCK:</span>
                    <span>{new Date(receiptDetails.timestamp).toLocaleDateString()}  {new Date(receiptDetails.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SECURE CASHIER:</span>
                    <span>{receiptDetails.cashier_name}</span>
                  </div>
                </div>

                {/* Items Bought list */}
                <div className="py-4 border-b border-dashed border-[#23272F] space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-[#718096] uppercase">
                    <span>Description / Qty</span>
                    <span>Subtotal</span>
                  </div>
                  
                  {receiptDetails.items.map((item: any) => (
                    <div key={item.product.id} className="text-[11px] space-y-0.5">
                      <div className="flex justify-between font-bold text-[#E2E8F0] leading-none">
                        <span>{item.product.name}</span>
                        <span>${(item.quantity * item.product.price).toFixed(2)}</span>
                      </div>
                      <div className="text-[9.5px] text-[#718096]">
                        {item.quantity} units × ${item.product.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Billings summary */}
                <div className="py-3 text-[11px] space-y-1.5 border-b border-dashed border-[#23272F] text-[#718096]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${receiptDetails.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sales Tax (10%)</span>
                    <span>${receiptDetails.taxAmount.toFixed(2)}</span>
                  </div>
                  {receiptDetails.discount > 0 && (
                    <div className="flex justify-between text-[#48BB78]">
                      <span>Applied Discount</span>
                      <span>-${receiptDetails.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-[13px] text-[#00D1FF] pt-1.5 border-t border-dashed border-[#23272F]">
                    <span>TOTAL PAYABLE</span>
                    <span>${receiptDetails.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Salutation Greeting Footnotes */}
                <div className="text-center pt-5 pb-2 text-[10px] space-y-2 text-[#718096]">
                  <p className="italic font-sans">*** Transaction Logged & Verified ***</p>
                  
                  {/* barcode mockup */}
                  <div className="h-6 w-36 mx-auto bg-[#718096] opacity-30 rounded"></div>
                  
                  <span className="text-[8.5px] uppercase font-sans select-none tracking-widest font-bold">Ledger Verified Safe</span>
                </div>

              </div>
            </div>

            {/* Print trigger triggers */}
            <div className="p-4 bg-[#111318] border-t border-[#23272F] flex gap-2">
              <button 
                type="button" 
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-[#0A0B0E] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <Printer size={13} /> Print thermal receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
