-- 
-- Culinex POS Professional Schema for Supabase
-- Versión: 2.0 (Marzo 2026)
-- 

-- --- ENUMS (Tipos de Datos) ---
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING', 'COOKING', 'READY', 'SERVED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_source AS ENUM ('DINE_IN', 'UBER_EATS', 'RAPPI', 'PICKUP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'TRANSFER', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'WARNING', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE expense_category AS ENUM ('Insumos', 'Mantenimiento', 'Nomina', 'Servicios', 'Otros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_area AS ENUM ('Kitchen', 'Service', 'Bar', 'Management');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_status AS ENUM ('ON_SHIFT', 'OFF_SHIFT', 'BREAK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- --- TABLES (Esquema Principal) ---

-- 1. Restaurantes/Perfiles (Admin Principal)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  restaurant_id TEXT UNIQUE DEFAULT 'RONIN-REST-001',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Menú Digital
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  inventory_level INTEGER DEFAULT 4,
  description TEXT,
  status TEXT CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
  gramaje TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Mesas y Plano del Piso
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seats INTEGER DEFAULT 4,
  status table_status DEFAULT 'AVAILABLE',
  pos_x INTEGER DEFAULT 0,
  pos_y INTEGER DEFAULT 0,
  assigned_waiter_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Órdenes / Ventas
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES tables(id),
  status order_status DEFAULT 'PENDING',
  source order_source DEFAULT 'DINE_IN',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  waiter_name TEXT,
  payment_status payment_status DEFAULT 'PENDING',
  payment_method payment_method,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  split_type TEXT DEFAULT 'NONE',
  received_amount DECIMAL(10,2) DEFAULT 0,
  change_amount DECIMAL(10,2) DEFAULT 0,
  paid_splits INTEGER DEFAULT 0,
  invoice_rfc TEXT,
  invoice_legal_name TEXT,
  invoice_email TEXT,
  invoice_use_cfdi TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Detalle de Orden
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_sale DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Gastos de Caja Chica
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category expense_category DEFAULT 'Otros',
  recorded_by UUID REFERENCES auth.users,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Personal y Gestión de RRHH
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  area staff_area DEFAULT 'Service',
  status staff_status DEFAULT 'OFF_SHIFT',
  pin TEXT NOT NULL,
  image_url TEXT,
  rating DECIMAL(2,1) DEFAULT 5.0,
  phone TEXT,
  hours_worked_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Inventario y Stock
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'Kg',
  cost_per_unit DECIMAL(10,2),
  max_stock DECIMAL(10,2),
  min_stock DECIMAL(10,2),
  supplier TEXT,
  last_restock TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Lista de Espera (Hostess)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK (status IN ('WAITING', 'ASSIGNED', 'CANCELLED')) DEFAULT 'WAITING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Configuración del Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT DEFAULT 'RONIN STUDIO',
  logo_url TEXT,
  theme_id TEXT DEFAULT 'indigo',
  is_terminal_enabled BOOLEAN DEFAULT FALSE,
  is_kitchen_printing_enabled BOOLEAN DEFAULT TRUE,
  subscription_status subscription_status DEFAULT 'ACTIVE',
  expiry_date TIMESTAMPTZ DEFAULT (NOW() + interval '30 days'),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- --- SECURITY / RLS ---
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Auth access" ON profiles;
CREATE POLICY "Auth access" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read menu" ON menu_items;
CREATE POLICY "Public read menu" ON menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin CRUD menu" ON menu_items;
CREATE POLICY "Admin CRUD menu" ON menu_items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Full access Orders" ON orders;
CREATE POLICY "Full access Orders" ON orders FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Full access Expenses" ON expenses;
CREATE POLICY "Full access Expenses" ON expenses FOR ALL USING (auth.role() = 'authenticated');


-- --- TRIGGERS ---
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_settings_updated_at ON system_settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
