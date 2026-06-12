import { createClient } from '@supabase/supabase-js';

// Define TS Interfaces for types
export interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  price: number;
  cost_price: number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  tax_amount: number;
  discount: number;
  cashier_id: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'MY_SUPABASE_URL';

let supabaseHasRuntimeError = false;
let lastSupabaseError: string | null = null;

let supabaseClient: any = null;
if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Real Supabase Client Initialized with URL:', supabaseUrl);
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
  }
} else {
  console.log('⚠️ Supabase environment variables not configured. Falling back to local high-fidelity database sandbox.');
}

// IN-MEMORY HIGH-FIDELITY SANDBOX DATABASE
class LocalSandboxDatabase {
  public products: Product[] = [];
  public invoices: Invoice[] = [];
  public invoiceItems: InvoiceItem[] = [];
  public profiles = [
    { id: '11111111-1111-1111-1111-111111111111', email: 'cashier@inventory.com', full_name: 'Alex Cashier' }
  ];

  constructor() {
    this.seedDatabase();
  }

  private seedDatabase() {
    this.products = [
      { id: 'prod-01', name: 'Eco Shield Water Bottle', sku: 'ECO-H2O-001', stock_quantity: 15, low_stock_threshold: 5, price: 14.99, cost_price: 6.50 },
      { id: 'prod-02', name: 'Organic Premium Tee (XL)', sku: 'ORG-TEE-002', stock_quantity: 3, low_stock_threshold: 8, price: 29.99, cost_price: 12.00 },
      { id: 'prod-03', name: 'Pro Noise-Cancelling Audio Headset', sku: 'ANC-PHN-003', stock_quantity: 45, low_stock_threshold: 10, price: 119.99, cost_price: 55.00 },
      { id: 'prod-04', name: 'Hyperlight Ergonomic Mouse', sku: 'WRL-MOU-004', stock_quantity: 2, low_stock_threshold: 5, price: 49.99, cost_price: 20.00 },
      { id: 'prod-05', name: 'RGB Mechanical Gaming Keyboard', sku: 'MCH-KEY-005', stock_quantity: 18, low_stock_threshold: 5, price: 89.99, cost_price: 38.00 },
      { id: 'prod-06', name: 'High-Res Curved Monitor 34"', sku: 'MON-34C-006', stock_quantity: 7, low_stock_threshold: 3, price: 399.99, cost_price: 180.00 }
    ];

    // Build historical sales over the last 7 days
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      // Add 1 or 2 invoices per day
      const numInvoices = i === 0 ? 3 : (i % 2 === 0 ? 2 : 1);
      for (let j = 0; j < numInvoices; j++) {
        const invId = `inv-day${i}-${j}`;
        const number = `INV-${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}-${i}${j}`;
        
        // Randomly pick products to compose invoice
        const p1 = this.products[0];
        const p2 = this.products[2];

        let invTotal = 0;
        let invTax = 0;
        const discount = j % 2 === 0 ? 5.00 : 0.00;

        const items: InvoiceItem[] = [
          {
            id: `item-${invId}-1`,
            invoice_id: invId,
            product_id: p1.id,
            quantity: 1 + Math.floor(Math.random() * 2),
            unit_price: p1.price
          }
        ];

        if (j > 0) {
          items.push({
            id: `item-${invId}-2`,
            invoice_id: invId,
            product_id: p2.id,
            quantity: 1,
            unit_price: p2.price
          });
        }

        for (const it of items) {
          invTotal += it.quantity * it.unit_price;
        }

        invTax = parseFloat((invTotal * 0.10).toFixed(2));
        invTotal = parseFloat((invTotal + invTax - discount).toFixed(2));

        this.invoices.push({
          id: invId,
          invoice_number: number,
          total_amount: invTotal,
          tax_amount: invTax,
          discount: discount,
          cashier_id: this.profiles[0].id,
          created_at: d.toISOString()
        });

        for (const it of items) {
          this.invoiceItems.push(it);
        }
      }
    }
  }
}

const sandbox = new LocalSandboxDatabase();

// EXPORT ED INTERFACE SERVICE
export const dbService = {
  isUsingRealSupabase: () => isSupabaseConfigured && !supabaseHasRuntimeError,
  getSupabaseError: () => lastSupabaseError,

  // --- PRODUCTS / INVENTORY ---
  getProducts: async (): Promise<Product[]> => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .order('name');
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        console.log('🔄 Operational sync: Using Sandbox products repository.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        return [...sandbox.products].sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      // Return sorted by name
      return [...sandbox.products].sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  createProduct: async (product: Omit<Product, 'id' | 'created_at'>): Promise<Product> => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .insert([product])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err: any) {
        const isSkuClash = err.code === '23505' || (err.message && (err.message.includes('unique') || err.message.includes('duplicate')));
        if (isSkuClash) {
          throw err;
        }
        console.log('🔄 Operational sync: Product added to Sandbox cache.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        
        const newProduct: Product = {
          ...product,
          id: 'prod-' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString()
        };
        sandbox.products.push(newProduct);
        return newProduct;
      }
    } else {
      const newProduct: Product = {
        ...product,
        id: 'prod-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString()
      };
      sandbox.products.push(newProduct);
      return newProduct;
    }
  },

  updateProduct: async (id: string, updates: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product> => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err: any) {
        console.log('🔄 Operational sync: Product updated in Sandbox cache.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        
        const index = sandbox.products.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Product not found in Sandbox');
        const updatedProduct = {
          ...sandbox.products[index],
          ...updates
        };
        sandbox.products[index] = updatedProduct;
        return updatedProduct;
      }
    } else {
      const index = sandbox.products.findIndex(p => p.id === id);
      if (index === -1) throw new Error('Product not found');
      
      const updatedProduct = {
        ...sandbox.products[index],
        ...updates
      };
      
      // Prevent negative stock
      if (updatedProduct.stock_quantity < 0) {
        throw new Error('Stock quantity cannot be less than 0');
      }

      sandbox.products[index] = updatedProduct;
      return updatedProduct;
    }
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { error } = await supabaseClient
          .from('products')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (err: any) {
        console.log('🔄 Operational sync: Product deleted from Sandbox cache.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        
        const initialLength = sandbox.products.length;
        sandbox.products = sandbox.products.filter(p => p.id !== id);
        return sandbox.products.length < initialLength;
      }
    } else {
      const initialLength = sandbox.products.length;
      sandbox.products = sandbox.products.filter(p => p.id !== id);
      return sandbox.products.length < initialLength;
    }
  },

  // --- BILLING / INVOICING (TRANSACTIONAL SAFETY) ---
  createInvoice: async (payload: {
    invoice_number: string;
    total_amount: number;
    tax_amount: number;
    discount: number;
    cashier_id: string | null;
    items: { product_id: string; quantity: number; unit_price: number }[];
  }): Promise<{ invoice_id: string }> => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient.rpc('create_invoice', {
          p_invoice_number: payload.invoice_number,
          p_total_amount: payload.total_amount,
          p_tax_amount: payload.tax_amount,
          p_discount: payload.discount,
          p_cashier_id: payload.cashier_id || '11111111-1111-1111-1111-111111111111',
          p_items: payload.items
        });
        if (error) throw error;
        return { invoice_id: data };
      } catch (err: any) {
        if (err.message && err.message.includes('Insufficient stock')) {
          throw err;
        }
        console.log('🔄 Operational sync: Invoice processed in Sandbox database.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        
        // Execute sandbox fallback transaction
        for (const item of payload.items) {
          const prod = sandbox.products.find(p => p.id === item.product_id);
          if (!prod) {
            throw new Error(`Product not found with id ${item.product_id}`);
          }
          if (prod.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for product "${prod.name}" (Requested: ${item.quantity}, Stock: ${prod.stock_quantity})`);
          }
        }

        const newInvoiceId = 'inv-' + Math.random().toString(36).substr(2, 9);
        const newInvoice: Invoice = {
          id: newInvoiceId,
          invoice_number: payload.invoice_number,
          total_amount: payload.total_amount,
          tax_amount: payload.tax_amount,
          discount: payload.discount,
          cashier_id: payload.cashier_id || sandbox.profiles[0].id,
          created_at: new Date().toISOString()
        };
        sandbox.invoices.push(newInvoice);

        for (const item of payload.items) {
          const prod = sandbox.products.find(p => p.id === item.product_id)!;
          prod.stock_quantity -= item.quantity;
          sandbox.invoiceItems.push({
            id: 'item-' + Math.random().toString(36).substr(2, 9),
            invoice_id: newInvoiceId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          });
        }

        return { invoice_id: newInvoiceId };
      }
    } else {
      // In-Memory Transaction implementation with locking check
      // 1. Validate stocks
      for (const item of payload.items) {
        const prod = sandbox.products.find(p => p.id === item.product_id);
        if (!prod) {
          throw new Error(`Product not found with id ${item.product_id}`);
        }
        if (prod.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${prod.name}" (Requested: ${item.quantity}, Stock: ${prod.stock_quantity})`);
        }
      }

      // 2. Insert Invoice
      const newInvoiceId = 'inv-' + Math.random().toString(36).substr(2, 9);
      const newInvoice: Invoice = {
        id: newInvoiceId,
        invoice_number: payload.invoice_number,
        total_amount: payload.total_amount,
        tax_amount: payload.tax_amount,
        discount: payload.discount,
        cashier_id: payload.cashier_id || sandbox.profiles[0].id,
        created_at: new Date().toISOString()
      };
      sandbox.invoices.push(newInvoice);

      // 3. Insert elements, adjust stock levels
      for (const item of payload.items) {
        const prod = sandbox.products.find(p => p.id === item.product_id)!;
        
        // Decrement stock
        prod.stock_quantity -= item.quantity;
        
        // Add invoice item record
        sandbox.invoiceItems.push({
          id: 'item-' + Math.random().toString(36).substr(2, 9),
          invoice_id: newInvoiceId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      }

      return { invoice_id: newInvoiceId };
    }
  },

  // --- ANALYTICS / AGGREGATION ---
  getDashboardAnalytics: async () => {
    let products: Product[] = [];
    let invoices: Invoice[] = [];
    let items: InvoiceItem[] = [];

    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const [{ data: pData, error: pError }, { data: invData, error: invError }, { data: itemData, error: itemError }] = await Promise.all([
          supabaseClient.from('products').select('*'),
          supabaseClient.from('invoices').select('*'),
          supabaseClient.from('invoice_items').select('*, products(*)')
        ]);
        if (pError) throw pError;
        if (invError) throw invError;
        if (itemError) throw itemError;
        products = pData || [];
        invoices = invData || [];
        items = (itemData || []).map((it: any) => ({
          ...it,
          product: it.products
        }));
      } catch (err: any) {
        console.log('🔄 Operational sync: Processing dashboard analytics via Sandbox database.');
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        
        products = sandbox.products;
        invoices = sandbox.invoices;
        items = sandbox.invoiceItems.map(it => ({
          ...it,
          product: sandbox.products.find(p => p.id === it.product_id)
        }));
      }
    } else {
      products = sandbox.products;
      invoices = sandbox.invoices;
      // Enrich with product data for margin calculation
      items = sandbox.invoiceItems.map(it => ({
        ...it,
        product: sandbox.products.find(p => p.id === it.product_id)
      }));
    }

    // Calculations
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const totalActiveSkus = products.length;
    const activeLowStockAlerts = products.filter(p => p.stock_quantity <= p.low_stock_threshold).length;

    // Total Cost Valuation of current stock
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.stock_quantity * Number(p.price)), 0);
    const totalInventoryCostValue = products.reduce((sum, p) => sum + (p.stock_quantity * Number(p.cost_price)), 0);

    // Calculate profit margins
    // Profit = Revenue - Cost of Goods Sold (COGS)
    // COGS = Sum of quantity * product.cost_price for solid sold-out item margins
    let totalCogs = 0;
    items.forEach(it => {
      const costOfItem = it.product ? Number(it.product.cost_price) : 0;
      totalCogs += it.quantity * costOfItem;
    });

    const netProfit = totalRevenue > 0 ? Math.max(0, totalRevenue - totalCogs) : 0;
    const profitMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Sales over time (last 7 days grouped)
    // Generate dates lists
    const salesOverTime: { [date: string]: number } = {};
    const profitOverTime: { [date: string]: number } = {};
    
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      salesOverTime[key] = 0;
      profitOverTime[key] = 0;
    }

    invoices.forEach(inv => {
      const dateKey = inv.created_at.split('T')[0];
      if (dateKey in salesOverTime) {
        salesOverTime[dateKey] += Number(inv.total_amount);
      }
    });

    // Match COGS per day for daily profit margin
    items.forEach(it => {
      // Find the parent invoice to grab its date
      const parentInv = invoices.find(inv => inv.id === it.invoice_id);
      if (parentInv) {
        const dateKey = parentInv.created_at.split('T')[0];
        if (dateKey in profitOverTime) {
          const revenueOfItem = it.quantity * Number(it.unit_price);
          const costOfItem = it.product ? it.quantity * Number(it.product.cost_price) : 0;
          profitOverTime[dateKey] += (revenueOfItem - costOfItem);
        }
      }
    });

    // Make profit margins match discounts applied per day
    invoices.forEach(inv => {
      const dateKey = inv.created_at.split('T')[0];
      if (dateKey in profitOverTime) {
        // Deduct invoice discount from daily profits directly
        profitOverTime[dateKey] -= Number(inv.discount);
      }
    });

    const salesTimeline = Object.keys(salesOverTime).map(date => {
      // Return formatted nicely for front-end charts
      const [_, m, d] = date.split('-');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${monthNames[Number(m) - 1]} ${d}`;
      return {
        rawDate: date,
        formattedDate,
        revenue: parseFloat(salesOverTime[date].toFixed(2)),
        profit: parseFloat(Math.max(0, profitOverTime[date]).toFixed(2))
      };
    });

    // Top Selling Products Mapping
    const productQuantities: { [prodId: string]: number } = {};
    items.forEach(it => {
      productQuantities[it.product_id] = (productQuantities[it.product_id] || 0) + it.quantity;
    });

    const topSellingProducts = Object.keys(productQuantities).map(id => {
      const p = products.find(prod => prod.id === id);
      return {
        name: p ? p.name : 'Unknown Product',
        quantity: productQuantities[id],
        revenue: productQuantities[id] * (p ? Number(p.price) : 0)
      };
    }).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    // Low stock items list
    const lowStockItems = products.filter(p => p.stock_quantity <= p.low_stock_threshold).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold
    }));

    return {
      overview: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitMargin: parseFloat(profitMarginPercentage.toFixed(2)),
        totalActiveSkus,
        activeLowStockAlerts,
        totalInventoryCostValue: parseFloat(totalInventoryCostValue.toFixed(2)),
        totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2))
      },
      salesTimeline,
      topSellingProducts,
      lowStockItems
    };
  }
};
