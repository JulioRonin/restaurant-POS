-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Employees Table
create table employees (
  id text primary key default uuid_generate_v4()::text,
  name text not null,
  role text not null,
  area text not null check (area in ('Kitchen', 'Service', 'Bar', 'Management')),
  status text not null default 'OFF_SHIFT' check (status in ('ON_SHIFT', 'OFF_SHIFT', 'BREAK')),
  image text,
  rating numeric(3, 1) default 5.0,
  hours_worked numeric(10, 2) default 0,
  schedule jsonb, -- Stores array of {day, start, end}
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Tables Table
create table tables (
  id text primary key, -- Explicit IDs like 'T1', 'T2' are allowed
  name text not null,
  seats int not null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY')),
  x int not null, -- Floor plan x coordinate
  y int not null, -- Floor plan y coordinate
  assigned_waiter_id text references employees(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Menu Items Table
create table menu_items (
  id text primary key default uuid_generate_v4()::text,
  name text not null,
  price numeric(10, 2) not null,
  category text not null,
  image text,
  inventory_level int default 0 check (inventory_level between 0 and 4),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Inventory Items Table
create table inventory_items (
  id text primary key default uuid_generate_v4()::text,
  name text not null,
  category text not null,
  quantity numeric(10, 2) not null default 0,
  unit text not null,
  cost_per_unit numeric(10, 2) not null,
  max_stock numeric(10, 2),
  min_stock numeric(10, 2),
  supplier text,
  last_restock date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. Orders Table
create table orders (
  id text primary key default uuid_generate_v4()::text,
  table_id text references tables(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'COOKING', 'READY', 'SERVED', 'COMPLETED')),
  total numeric(10, 2) default 0,
  waiter_name text,
  payment_status text default 'PENDING' check (payment_status in ('PENDING', 'PAID', 'PARTIAL')),
  payment_method text check (payment_method in ('CASH', 'CARD', 'MIXED')),
  tip numeric(10, 2) default 0,
  split_type text check (split_type in ('EQUAL', 'CUSTOM', 'NONE')),
  invoice_details jsonb, -- Stores RFC, Legal Name, etc.
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 6. Order Items Table
create table order_items (
  id text primary key default uuid_generate_v4()::text,
  order_id text references orders(id) on delete cascade,
  menu_item_id text references menu_items(id),
  quantity int not null default 1,
  notes text,
  price_at_time numeric(10, 2) not null, -- Snapshot of price at time of order
  created_at timestamp with time zone default now()
);

-- 7. Reservations Table
create table reservations (
  id text primary key default uuid_generate_v4()::text,
  table_id text references tables(id) on delete cascade,
  customer_name text not null,
  pax int not null,
  reservation_time text not null, -- Format 'HH:MM'
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 8. Supplier Orders Table
create table supplier_orders (
  id text primary key default uuid_generate_v4()::text,
  supplier text not null,
  date date not null default current_date,
  status text not null default 'PENDING' check (status in ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED')),
  total_cost numeric(10, 2) default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 9. Supplier Order Items Table
create table supplier_order_items (
  id text primary key default uuid_generate_v4()::text,
  supplier_order_id text references supplier_orders(id) on delete cascade,
  inventory_item_id text references inventory_items(id),
  order_quantity numeric(10, 2) not null,
  created_at timestamp with time zone default now()
);

-- 10. Enable Row Level Security (RLS)
alter table employees enable row level security;
alter table tables enable row level security;
alter table menu_items enable row level security;
alter table inventory_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reservations enable row level security;
alter table supplier_orders enable row level security;
alter table supplier_order_items enable row level security;

-- 11. Create Policies
-- For development, we will allow all operations for authenticated users.

-- Employees
create policy "Enable all for authenticated users" on employees for all using (auth.role() = 'authenticated');
create policy "Enable read for anon" on employees for select using (true); -- Allow login/public views if needed

-- Tables
create policy "Enable all for authenticated users" on tables for all using (auth.role() = 'authenticated');
create policy "Enable read for anon" on tables for select using (true);

-- Menu Items
create policy "Enable all for authenticated users" on menu_items for all using (auth.role() = 'authenticated');
create policy "Enable read for anon" on menu_items for select using (true);

-- Inventory Items
create policy "Enable all for authenticated users" on inventory_items for all using (auth.role() = 'authenticated');

-- Orders
create policy "Enable all for authenticated users" on orders for all using (auth.role() = 'authenticated');

-- Order Items
create policy "Enable all for authenticated users" on order_items for all using (auth.role() = 'authenticated');

-- Reservations
create policy "Enable all for authenticated users" on reservations for all using (auth.role() = 'authenticated');

-- Supplier Orders
create policy "Enable all for authenticated users" on supplier_orders for all using (auth.role() = 'authenticated');

-- Supplier Order Items
create policy "Enable all for authenticated users" on supplier_order_items for all using (auth.role() = 'authenticated');

-- 12. Business Settings Table
create table if not exists business_settings (
  id text primary key default uuid_generate_v4()::text,
  business_id text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamp with time zone default now(),
  unique(business_id, key)
);

alter table business_settings enable row level security;
create policy "Enable all for authenticated users" on business_settings for all using (auth.role() = 'authenticated');

-- 13. Expenses Table
create table if not exists expenses (
  id text primary key default uuid_generate_v4()::text,
  business_id text not null,
  description text not null,
  amount numeric(10, 2) not null,
  category text not null,
  date timestamp with time zone default now(),
  executor text,
  created_at timestamp with time zone default now()
);

alter table expenses enable row level security;
create policy "Enable all for authenticated users" on expenses for all using (auth.role() = 'authenticated');
