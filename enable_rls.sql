-- Run this script to enable security on your EXISTING tables.

-- 1. Enable Row Level Security (RLS) on all tables
alter table employees enable row level security;
alter table tables enable row level security;
alter table menu_items enable row level security;
alter table inventory_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reservations enable row level security;
alter table supplier_orders enable row level security;
alter table supplier_order_items enable row level security;

-- 2. Create Policies
-- allow all interactions for authenticated users

-- Employees
create policy "Enable all for authenticated users" on employees for all using (auth.role() = 'authenticated');
create policy "Enable read for anon" on employees for select using (true);

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
