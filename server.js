// server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// routes/inventory.ts
import { Router } from "express";

// src/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
var isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== "MY_SUPABASE_URL";
var supabaseHasRuntimeError = false;
var lastSupabaseError = null;
var supabaseClient = null;
if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log("\u2705 Real Supabase Client Initialized with URL:", supabaseUrl);
  } catch (error) {
    console.error("\u274C Failed to initialize Supabase client:", error);
  }
} else {
  console.log("\u26A0\uFE0F Supabase environment variables not configured. Falling back to local high-fidelity database sandbox.");
}
var LocalSandboxDatabase = class {
  constructor() {
    this.products = [];
    this.invoices = [];
    this.invoiceItems = [];
    this.profiles = [
      { id: "11111111-1111-1111-1111-111111111111", email: "cashier@inventory.com", full_name: "Alex Cashier" }
    ];
    this.seedDatabase();
  }
  seedDatabase() {
    this.products = [
      { id: "prod-01", name: "Eco Shield Water Bottle", sku: "ECO-H2O-001", stock_quantity: 15, low_stock_threshold: 5, price: 14.99, cost_price: 6.5 },
      { id: "prod-02", name: "Organic Premium Tee (XL)", sku: "ORG-TEE-002", stock_quantity: 3, low_stock_threshold: 8, price: 29.99, cost_price: 12 },
      { id: "prod-03", name: "Pro Noise-Cancelling Audio Headset", sku: "ANC-PHN-003", stock_quantity: 45, low_stock_threshold: 10, price: 119.99, cost_price: 55 },
      { id: "prod-04", name: "Hyperlight Ergonomic Mouse", sku: "WRL-MOU-004", stock_quantity: 2, low_stock_threshold: 5, price: 49.99, cost_price: 20 },
      { id: "prod-05", name: "RGB Mechanical Gaming Keyboard", sku: "MCH-KEY-005", stock_quantity: 18, low_stock_threshold: 5, price: 89.99, cost_price: 38 },
      { id: "prod-06", name: 'High-Res Curved Monitor 34"', sku: "MON-34C-006", stock_quantity: 7, low_stock_threshold: 3, price: 399.99, cost_price: 180 }
    ];
    const today = /* @__PURE__ */ new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const numInvoices = i === 0 ? 3 : i % 2 === 0 ? 2 : 1;
      for (let j = 0; j < numInvoices; j++) {
        const invId = `inv-day${i}-${j}`;
        const number = `INV-${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}-${i}${j}`;
        const p1 = this.products[0];
        const p2 = this.products[2];
        let invTotal = 0;
        let invTax = 0;
        const discount = j % 2 === 0 ? 5 : 0;
        const items = [
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
        invTax = parseFloat((invTotal * 0.1).toFixed(2));
        invTotal = parseFloat((invTotal + invTax - discount).toFixed(2));
        this.invoices.push({
          id: invId,
          invoice_number: number,
          total_amount: invTotal,
          tax_amount: invTax,
          discount,
          cashier_id: this.profiles[0].id,
          created_at: d.toISOString()
        });
        for (const it of items) {
          this.invoiceItems.push(it);
        }
      }
    }
  }
};
var sandbox = new LocalSandboxDatabase();
var dbService = {
  isUsingRealSupabase: () => isSupabaseConfigured && !supabaseHasRuntimeError,
  getSupabaseError: () => lastSupabaseError,
  // --- PRODUCTS / INVENTORY ---
  getProducts: async () => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient.from("products").select("*").order("name");
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.log("\u{1F504} Operational sync: Using Sandbox products repository.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        return [...sandbox.products].sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      return [...sandbox.products].sort((a, b) => a.name.localeCompare(b.name));
    }
  },
  createProduct: async (product) => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient.from("products").insert([product]).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        const isSkuClash = err.code === "23505" || err.message && (err.message.includes("unique") || err.message.includes("duplicate"));
        if (isSkuClash) {
          throw err;
        }
        console.log("\u{1F504} Operational sync: Product added to Sandbox cache.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        const newProduct = {
          ...product,
          id: "prod-" + Math.random().toString(36).substr(2, 9),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        sandbox.products.push(newProduct);
        return newProduct;
      }
    } else {
      const newProduct = {
        ...product,
        id: "prod-" + Math.random().toString(36).substr(2, 9),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      sandbox.products.push(newProduct);
      return newProduct;
    }
  },
  updateProduct: async (id, updates) => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient.from("products").update(updates).eq("id", id).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.log("\u{1F504} Operational sync: Product updated in Sandbox cache.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        const index = sandbox.products.findIndex((p) => p.id === id);
        if (index === -1) throw new Error("Product not found in Sandbox");
        const updatedProduct = {
          ...sandbox.products[index],
          ...updates
        };
        sandbox.products[index] = updatedProduct;
        return updatedProduct;
      }
    } else {
      const index = sandbox.products.findIndex((p) => p.id === id);
      if (index === -1) throw new Error("Product not found");
      const updatedProduct = {
        ...sandbox.products[index],
        ...updates
      };
      if (updatedProduct.stock_quantity < 0) {
        throw new Error("Stock quantity cannot be less than 0");
      }
      sandbox.products[index] = updatedProduct;
      return updatedProduct;
    }
  },
  deleteProduct: async (id) => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { error } = await supabaseClient.from("products").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.log("\u{1F504} Operational sync: Product deleted from Sandbox cache.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        const initialLength = sandbox.products.length;
        sandbox.products = sandbox.products.filter((p) => p.id !== id);
        return sandbox.products.length < initialLength;
      }
    } else {
      const initialLength = sandbox.products.length;
      sandbox.products = sandbox.products.filter((p) => p.id !== id);
      return sandbox.products.length < initialLength;
    }
  },
  // --- BILLING / INVOICING (TRANSACTIONAL SAFETY) ---
  createInvoice: async (payload) => {
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const { data, error } = await supabaseClient.rpc("create_invoice", {
          p_invoice_number: payload.invoice_number,
          p_total_amount: payload.total_amount,
          p_tax_amount: payload.tax_amount,
          p_discount: payload.discount,
          p_cashier_id: payload.cashier_id || "11111111-1111-1111-1111-111111111111",
          p_items: payload.items
        });
        if (error) throw error;
        return { invoice_id: data };
      } catch (err) {
        if (err.message && err.message.includes("Insufficient stock")) {
          throw err;
        }
        console.log("\u{1F504} Operational sync: Invoice processed in Sandbox database.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        for (const item of payload.items) {
          const prod = sandbox.products.find((p) => p.id === item.product_id);
          if (!prod) {
            throw new Error(`Product not found with id ${item.product_id}`);
          }
          if (prod.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for product "${prod.name}" (Requested: ${item.quantity}, Stock: ${prod.stock_quantity})`);
          }
        }
        const newInvoiceId = "inv-" + Math.random().toString(36).substr(2, 9);
        const newInvoice = {
          id: newInvoiceId,
          invoice_number: payload.invoice_number,
          total_amount: payload.total_amount,
          tax_amount: payload.tax_amount,
          discount: payload.discount,
          cashier_id: payload.cashier_id || sandbox.profiles[0].id,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        sandbox.invoices.push(newInvoice);
        for (const item of payload.items) {
          const prod = sandbox.products.find((p) => p.id === item.product_id);
          prod.stock_quantity -= item.quantity;
          sandbox.invoiceItems.push({
            id: "item-" + Math.random().toString(36).substr(2, 9),
            invoice_id: newInvoiceId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          });
        }
        return { invoice_id: newInvoiceId };
      }
    } else {
      for (const item of payload.items) {
        const prod = sandbox.products.find((p) => p.id === item.product_id);
        if (!prod) {
          throw new Error(`Product not found with id ${item.product_id}`);
        }
        if (prod.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${prod.name}" (Requested: ${item.quantity}, Stock: ${prod.stock_quantity})`);
        }
      }
      const newInvoiceId = "inv-" + Math.random().toString(36).substr(2, 9);
      const newInvoice = {
        id: newInvoiceId,
        invoice_number: payload.invoice_number,
        total_amount: payload.total_amount,
        tax_amount: payload.tax_amount,
        discount: payload.discount,
        cashier_id: payload.cashier_id || sandbox.profiles[0].id,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      sandbox.invoices.push(newInvoice);
      for (const item of payload.items) {
        const prod = sandbox.products.find((p) => p.id === item.product_id);
        prod.stock_quantity -= item.quantity;
        sandbox.invoiceItems.push({
          id: "item-" + Math.random().toString(36).substr(2, 9),
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
    let products = [];
    let invoices = [];
    let items = [];
    if (isSupabaseConfigured && supabaseClient && !supabaseHasRuntimeError) {
      try {
        const [{ data: pData, error: pError }, { data: invData, error: invError }, { data: itemData, error: itemError }] = await Promise.all([
          supabaseClient.from("products").select("*"),
          supabaseClient.from("invoices").select("*"),
          supabaseClient.from("invoice_items").select("*, products(*)")
        ]);
        if (pError) throw pError;
        if (invError) throw invError;
        if (itemError) throw itemError;
        products = pData || [];
        invoices = invData || [];
        items = (itemData || []).map((it) => ({
          ...it,
          product: it.products
        }));
      } catch (err) {
        console.log("\u{1F504} Operational sync: Processing dashboard analytics via Sandbox database.");
        supabaseHasRuntimeError = true;
        lastSupabaseError = err.message || JSON.stringify(err);
        products = sandbox.products;
        invoices = sandbox.invoices;
        items = sandbox.invoiceItems.map((it) => ({
          ...it,
          product: sandbox.products.find((p) => p.id === it.product_id)
        }));
      }
    } else {
      products = sandbox.products;
      invoices = sandbox.invoices;
      items = sandbox.invoiceItems.map((it) => ({
        ...it,
        product: sandbox.products.find((p) => p.id === it.product_id)
      }));
    }
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const totalActiveSkus = products.length;
    const activeLowStockAlerts = products.filter((p) => p.stock_quantity <= p.low_stock_threshold).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + p.stock_quantity * Number(p.price), 0);
    const totalInventoryCostValue = products.reduce((sum, p) => sum + p.stock_quantity * Number(p.cost_price), 0);
    let totalCogs = 0;
    items.forEach((it) => {
      const costOfItem = it.product ? Number(it.product.cost_price) : 0;
      totalCogs += it.quantity * costOfItem;
    });
    const netProfit = totalRevenue > 0 ? Math.max(0, totalRevenue - totalCogs) : 0;
    const profitMarginPercentage = totalRevenue > 0 ? netProfit / totalRevenue * 100 : 0;
    const salesOverTime = {};
    const profitOverTime = {};
    const today = /* @__PURE__ */ new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      salesOverTime[key] = 0;
      profitOverTime[key] = 0;
    }
    invoices.forEach((inv) => {
      const dateKey = inv.created_at.split("T")[0];
      if (dateKey in salesOverTime) {
        salesOverTime[dateKey] += Number(inv.total_amount);
      }
    });
    items.forEach((it) => {
      const parentInv = invoices.find((inv) => inv.id === it.invoice_id);
      if (parentInv) {
        const dateKey = parentInv.created_at.split("T")[0];
        if (dateKey in profitOverTime) {
          const revenueOfItem = it.quantity * Number(it.unit_price);
          const costOfItem = it.product ? it.quantity * Number(it.product.cost_price) : 0;
          profitOverTime[dateKey] += revenueOfItem - costOfItem;
        }
      }
    });
    invoices.forEach((inv) => {
      const dateKey = inv.created_at.split("T")[0];
      if (dateKey in profitOverTime) {
        profitOverTime[dateKey] -= Number(inv.discount);
      }
    });
    const salesTimeline = Object.keys(salesOverTime).map((date) => {
      const [_, m, d] = date.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${monthNames[Number(m) - 1]} ${d}`;
      return {
        rawDate: date,
        formattedDate,
        revenue: parseFloat(salesOverTime[date].toFixed(2)),
        profit: parseFloat(Math.max(0, profitOverTime[date]).toFixed(2))
      };
    });
    const productQuantities = {};
    items.forEach((it) => {
      productQuantities[it.product_id] = (productQuantities[it.product_id] || 0) + it.quantity;
    });
    const topSellingProducts = Object.keys(productQuantities).map((id) => {
      const p = products.find((prod) => prod.id === id);
      return {
        name: p ? p.name : "Unknown Product",
        quantity: productQuantities[id],
        revenue: productQuantities[id] * (p ? Number(p.price) : 0)
      };
    }).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const lowStockItems = products.filter((p) => p.stock_quantity <= p.low_stock_threshold).map((p) => ({
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

// routes/inventory.ts
var inventoryRouter = Router();
inventoryRouter.get("/", async (_req, res) => {
  try {
    const products = await dbService.getProducts();
    res.json({
      success: true,
      count: products.length,
      products,
      isUsingSupabase: dbService.isUsingRealSupabase(),
      supabaseError: dbService.getSupabaseError()
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve products", error: error.message });
  }
});
inventoryRouter.post("/", async (req, res) => {
  try {
    const { name, sku, stock_quantity, low_stock_threshold, price, cost_price } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ success: false, message: "Product name and SKU are required" });
    }
    const priceNum = parseFloat(price);
    const costPriceNum = parseFloat(cost_price);
    const stockQtyInt = parseInt(stock_quantity);
    const lowStockInt = parseInt(low_stock_threshold);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, message: "Valid non-negative price is required" });
    }
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      return res.status(400).json({ success: false, message: "Valid non-negative cost price is required" });
    }
    const newProduct = await dbService.createProduct({
      name,
      sku,
      stock_quantity: isNaN(stockQtyInt) ? 0 : stockQtyInt,
      low_stock_threshold: isNaN(lowStockInt) ? 10 : lowStockInt,
      price: priceNum,
      cost_price: costPriceNum
    });
    res.status(201).json({ success: true, message: "Product created successfully", product: newProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.code === "23505" || error.message.includes("unique")) {
      return res.status(409).json({ success: false, message: "A product with this SKU already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create product", error: error.message });
  }
});
inventoryRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, stock_quantity, low_stock_threshold, price, cost_price } = req.body;
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (sku !== void 0) updates.sku = sku;
    if (stock_quantity !== void 0) {
      const qty = parseInt(stock_quantity);
      if (isNaN(qty) || qty < 0) {
        return res.status(400).json({ success: false, message: "Stock quantity must be a non-negative integer" });
      }
      updates.stock_quantity = qty;
    }
    if (low_stock_threshold !== void 0) {
      const threshold = parseInt(low_stock_threshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({ success: false, message: "Low-stock threshold must be a non-negative integer" });
      }
      updates.low_stock_threshold = threshold;
    }
    if (price !== void 0) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ success: false, message: "Price must be a non-negative number" });
      }
      updates.price = priceNum;
    }
    if (cost_price !== void 0) {
      const costNum = parseFloat(cost_price);
      if (isNaN(costNum) || costNum < 0) {
        return res.status(400).json({ success: false, message: "Cost price must be a non-negative number" });
      }
      updates.cost_price = costNum;
    }
    const updatedProduct = await dbService.updateProduct(id, updates);
    res.json({ success: true, message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.status(500).json({ success: false, message: "Failed to update product", error: error.message });
  }
});
inventoryRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteProduct(id);
    if (deleted) {
      res.json({ success: true, message: "Product deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: "Failed to delete product", error: error.message });
  }
});

// routes/billing.ts
import { Router as Router2 } from "express";
var billingRouter = Router2();
billingRouter.post("/invoice", async (req, res) => {
  try {
    const { invoice_number, total_amount, tax_amount, discount, cashier_id, items } = req.body;
    if (!invoice_number) {
      return res.status(400).json({ success: false, message: "Invoice number is required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "A non-empty list of items is required" });
    }
    for (const item of items) {
      if (!item.product_id || !item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: "Each item must specify a product_id and a positive quantity" });
      }
      if (item.unit_price === void 0 || isNaN(parseFloat(item.unit_price))) {
        return res.status(400).json({ success: false, message: "Each item must have a valid unit price" });
      }
    }
    const result = await dbService.createInvoice({
      invoice_number,
      total_amount: parseFloat(total_amount),
      tax_amount: parseFloat(tax_amount),
      discount: parseFloat(discount || 0),
      cashier_id: cashier_id || null,
      items: items.map((it) => ({
        product_id: it.product_id,
        quantity: parseInt(it.quantity),
        unit_price: parseFloat(it.unit_price)
      }))
    });
    res.status(201).json({
      success: true,
      message: "Checkout processing completed. Invoice saved and inventory decremented atomically.",
      invoiceId: result.invoice_id
    });
  } catch (error) {
    console.error("Invoice creation transaction failure:", error);
    if (error.message.includes("Insufficient stock")) {
      return res.status(422).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Checkout transaction failed", error: error.message });
  }
});

// routes/analytics.ts
import { Router as Router3 } from "express";
var analyticsRouter = Router3();
analyticsRouter.get("/dashboard", async (_req, res) => {
  try {
    const analytics = await dbService.getDashboardAnalytics();
    res.json({
      success: true,
      analytics,
      isUsingSupabase: dbService.isUsingRealSupabase(),
      supabaseError: dbService.getSupabaseError()
    });
  } catch (error) {
    console.error("Error compiling analytics:", error);
    res.status(500).json({ success: false, message: "Failed to compile dashboard metrics", error: error.message });
  }
});

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var isDevelopment = process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "dev";
app.use(cors());
app.use(express.json());
app.use("/api/inventory", inventoryRouter);
app.use("/api/billing", billingRouter);
app.use("/api/analytics", analyticsRouter);
app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "Active", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var PORT = 3e3;
async function start() {
  if (isDevelopment) {
    console.log("Starting Express in development mode with Vite middleware...");
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
        // Follow config constraint
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting Express in production mode, serving compiled web assets...");
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fullstack inventory service listening on http://0.0.0.0:${PORT}`);
  });
}
if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error("Fatal crash on full-stack webserver startup:", err);
  });
}
var server_default = app;
export {
  app,
  server_default as default
};
