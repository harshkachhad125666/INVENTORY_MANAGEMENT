import { Router, Request, Response } from 'express';
import { dbService } from '../src/supabaseClient.ts';

export const inventoryRouter = Router();

// Handle GET / - Fetch all products
inventoryRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const products = await dbService.getProducts();
    res.json({ 
      success: true, 
      count: products.length, 
      products,
      isUsingSupabase: dbService.isUsingRealSupabase(),
      supabaseError: dbService.getSupabaseError()
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve products', error: error.message });
  }
});

// Handle POST / - Create a new product
inventoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, sku, stock_quantity, low_stock_threshold, price, cost_price } = req.body;

    // Validate request body
    if (!name || !sku) {
      return res.status(400).json({ success: false, message: 'Product name and SKU are required' });
    }

    const priceNum = parseFloat(price);
    const costPriceNum = parseFloat(cost_price);
    const stockQtyInt = parseInt(stock_quantity);
    const lowStockInt = parseInt(low_stock_threshold);

    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, message: 'Valid non-negative price is required' });
    }
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      return res.status(400).json({ success: false, message: 'Valid non-negative cost price is required' });
    }

    const newProduct = await dbService.createProduct({
      name,
      sku,
      stock_quantity: isNaN(stockQtyInt) ? 0 : stockQtyInt,
      low_stock_threshold: isNaN(lowStockInt) ? 10 : lowStockInt,
      price: priceNum,
      cost_price: costPriceNum
    });

    res.status(201).json({ success: true, message: 'Product created successfully', product: newProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    // Handle uniqueness error of SKU
    if (error.code === '23505' || error.message.includes('unique')) {
      return res.status(409).json({ success: false, message: 'A product with this SKU already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create product', error: error.message });
  }
});

// Handle PUT /:id - Update product details or manual restocking
inventoryRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sku, stock_quantity, low_stock_threshold, price, cost_price } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (sku !== undefined) updates.sku = sku;
    if (stock_quantity !== undefined) {
      const qty = parseInt(stock_quantity);
      if (isNaN(qty) || qty < 0) {
        return res.status(400).json({ success: false, message: 'Stock quantity must be a non-negative integer' });
      }
      updates.stock_quantity = qty;
    }
    if (low_stock_threshold !== undefined) {
      const threshold = parseInt(low_stock_threshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({ success: false, message: 'Low-stock threshold must be a non-negative integer' });
      }
      updates.low_stock_threshold = threshold;
    }
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
      }
      updates.price = priceNum;
    }
    if (cost_price !== undefined) {
      const costNum = parseFloat(cost_price);
      if (isNaN(costNum) || costNum < 0) {
        return res.status(400).json({ success: false, message: 'Cost price must be a non-negative number' });
      }
      updates.cost_price = costNum;
    }

    const updatedProduct = await dbService.updateProduct(id, updates);
    res.json({ success: true, message: 'Product updated successfully', product: updatedProduct });
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(500).json({ success: false, message: 'Failed to update product', error: error.message });
  }
});

// Handle DELETE /:id - Delete a product
inventoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteProduct(id);
    if (deleted) {
      res.json({ success: true, message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Product not found' });
    }
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
  }
});
