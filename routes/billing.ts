import { Router, Request, Response } from 'express';
import { dbService } from '../src/supabaseClient.ts';

export const billingRouter = Router();

// Handle POST /invoice - Atomically create an invoice and decrement stock levels
billingRouter.post('/invoice', async (req: Request, res: Response) => {
  try {
    const { invoice_number, total_amount, tax_amount, discount, cashier_id, items } = req.body;

    // Validate inputs
    if (!invoice_number) {
      return res.status(400).json({ success: false, message: 'Invoice number is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'A non-empty list of items is required' });
    }

    // Validate item structure
    for (const item of items) {
      if (!item.product_id || !item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each item must specify a product_id and a positive quantity' });
      }
      if (item.unit_price === undefined || isNaN(parseFloat(item.unit_price))) {
        return res.status(400).json({ success: false, message: 'Each item must have a valid unit price' });
      }
    }

    // Run transaction safely
    const result = await dbService.createInvoice({
      invoice_number,
      total_amount: parseFloat(total_amount),
      tax_amount: parseFloat(tax_amount),
      discount: parseFloat(discount || 0),
      cashier_id: cashier_id || null,
      items: items.map((it: any) => ({
        product_id: it.product_id,
        quantity: parseInt(it.quantity),
        unit_price: parseFloat(it.unit_price)
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Checkout processing completed. Invoice saved and inventory decremented atomically.',
      invoiceId: result.invoice_id
    });
  } catch (error: any) {
    console.error('Invoice creation transaction failure:', error);
    if (error.message.includes('Insufficient stock')) {
      return res.status(422).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Checkout transaction failed', error: error.message });
  }
});
