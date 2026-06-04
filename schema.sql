-- Database Initialization Schema
-- This schema represents the full PostgreSQL implementation.

-- 1. Create Profile Table linked to auth.users (Supabase Managed Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy: Profiles readable by authenticated users
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated users full access to products" ON public.products FOR ALL TO authenticated USING (true);

-- 3. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated users full access to invoices" ON public.invoices FOR ALL TO authenticated USING (true);

-- 4. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

-- Enable RLS for invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated users full access to invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (true);

-- 5. Trigger Function to link auth.users profile creations automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute when auth.users receives a new insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Transactional Stock-Deduction and Invoice-Creation Function (RPC)
-- This enforces transactional safety: if stock is insufficient for any item or anything fails,
-- the entire database transaction is rolled back atomicaly.
CREATE OR REPLACE FUNCTION public.create_invoice(
  p_invoice_number TEXT,
  p_total_amount NUMERIC,
  p_tax_amount NUMERIC,
  p_discount NUMERIC,
  p_cashier_id UUID,
  p_items JSONB -- Type array-of-objects: [{"product_id": "uuid", "quantity": int, "unit_price": numeric}]
)
RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_item JSONB;
  v_prod_id UUID;
  v_qty INTEGER;
  v_current_stock INTEGER;
BEGIN
  -- Validate stock levels first and lock records to prevent race conditions (Double spend / race condition protection)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT stock_quantity INTO v_current_stock
    FROM public.products
    WHERE id = v_prod_id
    FOR UPDATE; -- Explicit line locking

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product. (Required: %, Available: %)', v_qty, v_current_stock;
    END IF;
  END LOOP;

  -- Clear check, insert parent invoice
  INSERT INTO public.invoices (invoice_number, total_amount, tax_amount, discount, cashier_id)
  VALUES (p_invoice_number, p_total_amount, p_tax_amount, p_discount, p_cashier_id)
  RETURNING id INTO v_invoice_id;

  -- Create elements + reduce inventory in stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
    VALUES (v_invoice_id, v_prod_id, v_qty, (v_item->>'unit_price')::NUMERIC);

    UPDATE public.products
    SET stock_quantity = stock_quantity - v_qty
    WHERE id = v_prod_id;
  END LOOP;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
