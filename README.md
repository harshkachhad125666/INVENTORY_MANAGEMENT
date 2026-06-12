# Inventory & Billing Management System

A full-stack retail operations app for managing products, tracking stock levels, processing POS checkouts, and viewing sales analytics.

## Overview

The system is built as a single Node.js app that serves both the API and the React frontend.

- `Express` handles API routes and static production hosting.
- `Vite` powers the frontend during development.
- `Supabase` is the primary database backend when configured.
- A local in-memory sandbox is used automatically when Supabase is unavailable.

## Core Features

- Product catalog management with create, edit, delete, and search
- Low-stock alerts and manual restocking
- Billing terminal with cart management and invoice checkout
- Transactional invoice creation with stock deduction
- Dashboard analytics for revenue, profit, inventory value, and top-selling products
- Mobile-friendly sidebar navigation

## Project Structure

- `server.ts` - Express app, API mounting, and Vite integration
- `routes/inventory.ts` - Inventory CRUD endpoints
- `routes/billing.ts` - Invoice checkout endpoint
- `routes/analytics.ts` - Dashboard analytics endpoint
- `src/App.tsx` - Main application shell and navigation
- `src/components/Dashboard.tsx` - Analytics dashboard
- `src/components/Inventory.tsx` - Product catalog UI
- `src/components/BillingTerminal.tsx` - POS checkout UI
- `src/supabaseClient.ts` - Data access layer and sandbox fallback
- `schema.sql` - Supabase/PostgreSQL schema and RPC function

## Requirements

- Node.js 18 or newer
- npm
- Optional: a Supabase project if you want persistent storage

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create or update your environment file with the variables listed below.
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`

## Environment Variables

Use these variables in `.env` or your deployment environment:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `GEMINI_API_KEY` - Present in the template environment, but not required by the current app flow
- `APP_URL` - Base URL for the hosted app

If `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing, the app falls back to the local sandbox database so the UI still works.

## Available Scripts

- `npm run dev` - Start the Express server with Vite middleware
- `npm run build` - Build the frontend and bundle `server.ts` into `server.js`
- `npm run start` - Run the production server from `server.js`
- `npm run preview` - Preview the Vite frontend build
- `npm run lint` - Type-check the TypeScript codebase

## API Endpoints

### Health

- `GET /api/health`

Returns the service status and a timestamp.

### Inventory

- `GET /api/inventory`
- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`

Request notes:

- `POST` expects `name`, `sku`, `stock_quantity`, `low_stock_threshold`, `price`, and `cost_price`
- `PUT` accepts partial updates for the same product fields
- `sku` must be unique

### Billing

- `POST /api/billing/invoice`

Creates an invoice and deducts stock atomically.

Expected payload shape:

```json
{
  "invoice_number": "INV-20260605-123456",
  "total_amount": 149.99,
  "tax_amount": 13.64,
  "discount": 5,
  "cashier_id": null,
  "items": [
    {
      "product_id": "prod-01",
      "quantity": 2,
      "unit_price": 14.99
    }
  ]
}
```

### Analytics

- `GET /api/analytics/dashboard`

Returns overview metrics, a 7-day sales timeline, top-selling products, and low-stock items.

## Database Schema

The `schema.sql` file defines the Supabase tables and RPC function used by the production data layer:

- `profiles`
- `products`
- `invoices`
- `invoice_items`
- `create_invoice(...)` RPC for transactional checkout

Highlights:

- `products.sku` is unique
- stock and price fields enforce non-negative values
- `create_invoice` locks product rows and rolls back on insufficient stock
- profile rows are auto-created from `auth.users`

## How The App Works

- The dashboard reads analytics from `/api/analytics/dashboard`
- Inventory actions call `/api/inventory`
- Checkout calls `/api/billing/invoice`
- After any change, the UI triggers a refresh so all tabs stay in sync
- If Supabase fails at runtime, the data service switches to the sandbox store and keeps the app functional

## Sandbox Mode

When the Supabase connection is not configured or errors at runtime:

- Products are served from a seeded in-memory catalog
- Invoices are stored in memory
- Analytics are computed from the sandbox data
- The UI still behaves normally, but changes are not persisted after restart

## Production Build

1. Build the app:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm run start
   ```

The production server serves the compiled frontend from `dist` and keeps the API available on the same origin.

## Troubleshooting

- If the app opens but data is empty, check whether Supabase credentials are set correctly.
- If checkout fails with insufficient stock, restock the product in the inventory tab and retry.
- If analytics show sandbox mode unexpectedly, inspect the server logs for the first Supabase error.
- If port `3000` is already in use, stop the conflicting process before restarting the app.

## Notes

- The current app UI is branded as `STRATOS.OS` in the interface.
- The local sandbox is useful for development, demos, and validation without a live database.
- The repository includes `server.js`, which is the bundled production entry point generated by the build script.
