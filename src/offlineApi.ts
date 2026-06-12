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

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  tax_amount: number;
  discount: number;
  cashier_id: string | null;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface OfflineState {
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
}

const STORAGE_KEY = 'stratos-offline-ledger-v1';

const seedProducts: Product[] = [
  { id: 'prod-01', name: 'Eco Shield Water Bottle', sku: 'ECO-H2O-001', stock_quantity: 15, low_stock_threshold: 5, price: 14.99, cost_price: 6.5 },
  { id: 'prod-02', name: 'Organic Premium Tee (XL)', sku: 'ORG-TEE-002', stock_quantity: 3, low_stock_threshold: 8, price: 29.99, cost_price: 12 },
  { id: 'prod-03', name: 'Pro Noise-Cancelling Audio Headset', sku: 'ANC-PHN-003', stock_quantity: 45, low_stock_threshold: 10, price: 119.99, cost_price: 55 },
  { id: 'prod-04', name: 'Hyperlight Ergonomic Mouse', sku: 'WRL-MOU-004', stock_quantity: 2, low_stock_threshold: 5, price: 49.99, cost_price: 20 },
  { id: 'prod-05', name: 'RGB Mechanical Gaming Keyboard', sku: 'MCH-KEY-005', stock_quantity: 18, low_stock_threshold: 5, price: 89.99, cost_price: 38 },
  { id: 'prod-06', name: 'High-Res Curved Monitor 34"', sku: 'MON-34C-006', stock_quantity: 7, low_stock_threshold: 3, price: 399.99, cost_price: 180 }
];

function createSeedState(): OfflineState {
  const state: OfflineState = {
    products: seedProducts.map(product => ({ ...product })),
    invoices: [],
    invoiceItems: []
  };

  const today = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const invoiceCount = dayOffset === 0 ? 3 : dayOffset % 2 === 0 ? 2 : 1;

    for (let invoiceIndex = 0; invoiceIndex < invoiceCount; invoiceIndex++) {
      const invoiceId = `offline-inv-${dayOffset}-${invoiceIndex}`;
      const discount = invoiceIndex % 2 === 0 ? 5 : 0;
      const items: InvoiceItem[] = [
        {
          id: `offline-item-${invoiceId}-1`,
          invoice_id: invoiceId,
          product_id: 'prod-01',
          quantity: 1 + (invoiceIndex % 2),
          unit_price: 14.99
        }
      ];

      if (invoiceIndex > 0) {
        items.push({
          id: `offline-item-${invoiceId}-2`,
          invoice_id: invoiceId,
          product_id: 'prod-03',
          quantity: 1,
          unit_price: 119.99
        });
      }

      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const taxAmount = Number((subtotal * 0.1).toFixed(2));

      state.invoices.push({
        id: invoiceId,
        invoice_number: `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${dayOffset}${invoiceIndex}`,
        total_amount: Number((subtotal + taxAmount - discount).toFixed(2)),
        tax_amount: taxAmount,
        discount,
        cashier_id: null,
        created_at: date.toISOString()
      });

      state.invoiceItems.push(...items);
    }
  }

  return state;
}

function readState(): OfflineState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedState();
    writeState(seeded);
    return seeded;
  }

  try {
    return JSON.parse(raw) as OfflineState;
  } catch {
    const seeded = createSeedState();
    writeState(seeded);
    return seeded;
  }
}

function writeState(state: OfflineState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Backend returned non-JSON content');
  }

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Backend request failed');
  }

  return data;
}

function lowStockItems(products: Product[]) {
  return products
    .filter(product => product.stock_quantity <= product.low_stock_threshold)
    .map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold
    }));
}

function buildAnalytics(state: OfflineState) {
  const enrichedItems = state.invoiceItems.map(item => ({
    ...item,
    product: state.products.find(product => product.id === item.product_id)
  }));

  const totalRevenue = state.invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const totalInventoryValue = state.products.reduce((sum, product) => sum + product.stock_quantity * Number(product.price), 0);
  const totalInventoryCostValue = state.products.reduce((sum, product) => sum + product.stock_quantity * Number(product.cost_price), 0);
  const totalCogs = enrichedItems.reduce((sum, item) => sum + item.quantity * Number(item.product?.cost_price || 0), 0);
  const netProfit = Math.max(0, totalRevenue - totalCogs);

  const salesOverTime: Record<string, number> = {};
  const profitOverTime: Record<string, number> = {};
  const today = new Date();

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const key = date.toISOString().split('T')[0];
    salesOverTime[key] = 0;
    profitOverTime[key] = 0;
  }

  state.invoices.forEach(invoice => {
    const dateKey = invoice.created_at.split('T')[0];
    if (dateKey in salesOverTime) {
      salesOverTime[dateKey] += Number(invoice.total_amount);
      profitOverTime[dateKey] -= Number(invoice.discount);
    }
  });

  enrichedItems.forEach(item => {
    const parentInvoice = state.invoices.find(invoice => invoice.id === item.invoice_id);
    const dateKey = parentInvoice?.created_at.split('T')[0];
    if (dateKey && dateKey in profitOverTime) {
      profitOverTime[dateKey] += item.quantity * (Number(item.unit_price) - Number(item.product?.cost_price || 0));
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const salesTimeline = Object.keys(salesOverTime).map(date => {
    const [, month, day] = date.split('-');
    return {
      rawDate: date,
      formattedDate: `${monthNames[Number(month) - 1]} ${day}`,
      revenue: Number(salesOverTime[date].toFixed(2)),
      profit: Number(Math.max(0, profitOverTime[date]).toFixed(2))
    };
  });

  const productQuantities: Record<string, number> = {};
  enrichedItems.forEach(item => {
    productQuantities[item.product_id] = (productQuantities[item.product_id] || 0) + item.quantity;
  });

  const topSellingProducts = Object.keys(productQuantities)
    .map(productId => {
      const product = state.products.find(item => item.id === productId);
      return {
        name: product?.name || 'Unknown Product',
        quantity: productQuantities[productId],
        revenue: productQuantities[productId] * Number(product?.price || 0)
      };
    })
    .sort((first, second) => second.quantity - first.quantity)
    .slice(0, 5);

  return {
    overview: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      profitMargin: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0,
      totalActiveSkus: state.products.length,
      activeLowStockAlerts: lowStockItems(state.products).length,
      totalInventoryCostValue: Number(totalInventoryCostValue.toFixed(2)),
      totalInventoryValue: Number(totalInventoryValue.toFixed(2))
    },
    salesTimeline,
    topSellingProducts,
    lowStockItems: lowStockItems(state.products)
  };
}

export const offlineApi = {
  async getDashboardAnalytics() {
    try {
      return await fetchJson('/api/analytics/dashboard');
    } catch (error: any) {
      console.warn('Using offline dashboard data:', error.message);
      return {
        success: true,
        analytics: buildAnalytics(readState()),
        isUsingSupabase: false,
        supabaseError: 'Offline browser ledger active'
      };
    }
  },

  async getInventory() {
    try {
      return await fetchJson('/api/inventory');
    } catch (error: any) {
      console.warn('Using offline inventory data:', error.message);
      const state = readState();
      return {
        success: true,
        count: state.products.length,
        products: [...state.products].sort((first, second) => first.name.localeCompare(second.name)),
        isOffline: true
      };
    }
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at'>) {
    try {
      return await fetchJson('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
    } catch (error: any) {
      console.warn('Creating product offline:', error.message);
      const state = readState();
      if (state.products.some(item => item.sku === product.sku)) {
        return { success: false, message: 'A product with this SKU already exists' };
      }

      const newProduct = {
        ...product,
        id: `offline-prod-${crypto.randomUUID()}`,
        created_at: new Date().toISOString()
      };

      state.products.push(newProduct);
      writeState(state);
      return { success: true, product: newProduct, message: 'Product saved offline' };
    }
  },

  async updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'created_at'>>) {
    try {
      return await fetchJson(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (error: any) {
      console.warn('Updating product offline:', error.message);
      const state = readState();
      const index = state.products.findIndex(product => product.id === id);
      if (index === -1) {
        return { success: false, message: 'Product not found' };
      }

      state.products[index] = { ...state.products[index], ...updates };
      writeState(state);
      return { success: true, product: state.products[index], message: 'Product updated offline' };
    }
  },

  async deleteProduct(id: string) {
    try {
      return await fetchJson(`/api/inventory/${id}`, { method: 'DELETE' });
    } catch (error: any) {
      console.warn('Deleting product offline:', error.message);
      const state = readState();
      const nextProducts = state.products.filter(product => product.id !== id);
      if (nextProducts.length === state.products.length) {
        return { success: false, message: 'Product not found' };
      }

      state.products = nextProducts;
      state.invoiceItems = state.invoiceItems.filter(item => item.product_id !== id);
      writeState(state);
      return { success: true, message: 'Product deleted offline' };
    }
  },

  async createInvoice(payload: {
    invoice_number: string;
    total_amount: number;
    tax_amount: number;
    discount: number;
    cashier_id: string | null;
    items: { product_id: string; quantity: number; unit_price: number }[];
  }) {
    try {
      return await fetchJson('/api/billing/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error: any) {
      console.warn('Creating invoice offline:', error.message);
      const state = readState();

      for (const item of payload.items) {
        const product = state.products.find(productItem => productItem.id === item.product_id);
        if (!product) {
          return { success: false, message: `Product not found with id ${item.product_id}` };
        }
        if (product.stock_quantity < item.quantity) {
          return { success: false, message: `Insufficient stock for product "${product.name}"` };
        }
      }

      const invoiceId = `offline-inv-${crypto.randomUUID()}`;
      state.invoices.push({
        id: invoiceId,
        invoice_number: payload.invoice_number,
        total_amount: payload.total_amount,
        tax_amount: payload.tax_amount,
        discount: payload.discount,
        cashier_id: payload.cashier_id,
        created_at: new Date().toISOString()
      });

      payload.items.forEach(item => {
        const product = state.products.find(productItem => productItem.id === item.product_id)!;
        product.stock_quantity -= item.quantity;
        state.invoiceItems.push({
          id: `offline-item-${crypto.randomUUID()}`,
          invoice_id: invoiceId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      });

      writeState(state);
      return { success: true, invoiceId, message: 'Invoice saved offline' };
    }
  }
};
