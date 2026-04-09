-- ==========================================
-- CULINEX POS - COMPLETE MULTI-TENANT SETUP
-- Run this script in the Supabase SQL Editor
-- ==========================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. CORE TENANT TABLES
create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  legal_name text,
  rfc text,
  plan text default 'basic' check (plan in ('basic', 'premium', 'enterprise')),
  settings jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  role text not null check (role in ('super_admin', 'admin', 'manager', 'cashier', 'waiter', 'kitchen')),
  full_name text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. FEATURE FLAGS SYSTEM
create table if not exists features (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  name text not null,
  description text,
  is_active boolean default true
);

create table if not exists business_features (
  business_id uuid not null references businesses(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  enabled boolean default false,
  config jsonb default '{}'::jsonb,
  primary key (business_id, feature_id)
);

-- 4. BUSINESS CORE TABLES
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  role text not null,
  area text not null,
  email text,
  status text default 'OFF_SHIFT',
  image text,
  rating numeric(3, 1) default 5.0,
  hours_worked numeric(10, 2) default 0,
  schedule jsonb,
  pin text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists menu_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  category text not null,
  image text,
  description text,
  status text default 'ACTIVE',
  gramaje text,
  inventory_level int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists tables (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  seats int not null,
  status text default 'AVAILABLE',
  x int not null,
  y int not null,
  assigned_waiter_id uuid references employees(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  table_id uuid references tables(id),
  status text default 'PENDING',
  total numeric(10, 2) default 0,
  waiter_id uuid references employees(id),
  waiter_name text,
  payment_status text default 'PENDING',
  payment_method text,
  tip numeric(10, 2) default 0,
  invoice_details jsonb,
  source text default 'DINE_IN',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity int not null default 1,
  notes text,
  price_at_time numeric(10, 2) not null,
  created_at timestamp with time zone default now()
);

create table if not exists inventory_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  category text not null,
  quantity numeric(10, 2) default 0,
  unit text not null,
  cost_per_unit numeric(10, 2) not null,
  min_stock numeric(10, 2),
  max_stock numeric(10, 2),
  supplier text,
  last_restock date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. INITIAL DATA (FEATURES)
insert into features (key, name, description) values 
('basic_pos', 'Punto de Venta Básico', 'Ventas, mesas y tickets'),
('inventory_management', 'Gestión de Inventario', 'Control de stock y proveedores'),
('advanced_reporting', 'Reportes Avanzados', 'Gráficas y analítica de ventas')
on conflict (key) do nothing;

-- 6. AUTOMATIC ONBOARDING (TRIGGER)
-- This function runs automatically when a new user signs up.
-- It reads 'business_name' and 'full_name' from the user's metadata.
create or replace function public.handle_new_user_onboarding()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_business_id uuid;
  new_location_id uuid;
  b_name text;
  f_name text;
begin
  -- 1. Extract metadata passed from the client during signUp
  b_name := coalesce(new.raw_user_meta_data->>'business_name', 'Mi Nuevo Negocio');
  f_name := coalesce(new.raw_user_meta_data->>'full_name', 'Administrador');

  -- 2. Create the Business
  insert into public.businesses (name, plan)
  values (b_name, 'basic')
  returning id into new_business_id;

  -- 3. Create the Main/Initial Location
  insert into public.locations (business_id, name)
  values (new_business_id, 'Sucursal Principal')
  returning id into new_location_id;

  -- 4. Create the Admin Profile for the registered user
  insert into public.profiles (id, business_id, location_id, role, full_name)
  values (new.id, new_business_id, new_location_id, 'admin', f_name);

    -- Create the initial Admin employee for this business
    INSERT INTO public.employees (
        id, 
        business_id, 
        location_id, 
        name, 
        role, 
        area, 
        email, 
        status, 
        pin, 
        image
    ) VALUES (
        uuid_generate_v4(),
        new_business_id,
        new_location_id,
        f_name,
        'Admin',
        'Administración',
        new.email,
        'OFF_SHIFT',
        NULL, -- Set to NULL to trigger PIN setup on first login
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&h=256&auto=format&fit=crop'
    );

  -- Default features are manual-only now

  return new;
end;
$$;

-- Trigger to execute onboarding after a new user is created in auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_onboarding();

-- 7. HELPERS FOR RLS
create or replace function get_my_business_id() returns uuid as $$ select business_id from public.profiles where id = auth.uid(); $$ language sql stable security definer;
create or replace function get_my_location_id() returns uuid as $$ select location_id from public.profiles where id = auth.uid(); $$ language sql stable security definer;
create or replace function is_super_admin() returns boolean as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'); $$ language sql stable security definer;
create or replace function has_role(required_role text) returns boolean as $$ select exists (select 1 from public.profiles where id = auth.uid() and (role = required_role or role = 'super_admin')); $$ language sql stable security definer;

-- 8. SECURITY - RLS
alter table businesses enable row level security;
alter table locations enable row level security;
alter table profiles enable row level security;
alter table features enable row level security;
alter table business_features enable row level security;
alter table employees enable row level security;
alter table menu_items enable row level security;
alter table tables enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_items enable row level security;

-- Policies (Simplified for setup)
drop policy if exists "members_isolation" on businesses;
create policy "members_isolation" on businesses for all using (id = get_my_business_id() or is_super_admin());

drop policy if exists "locations_isolation" on locations;
create policy "locations_isolation" on locations for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "profiles_isolation" on profiles;
create policy "profiles_isolation" on profiles for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "orders_isolation" on orders;
create policy "orders_isolation" on orders for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "menu_isolation" on menu_items;
create policy "menu_isolation" on menu_items for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "employee_isolation" on employees;
create policy "employee_isolation" on employees for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "inventory_isolation" on inventory_items;
create policy "inventory_isolation" on inventory_items for all using (business_id = get_my_business_id() or is_super_admin());

drop policy if exists "features_admin" on features;
create policy "features_admin" on features for all using (is_super_admin());
create policy "features_read" on features for select using (true);

drop policy if exists "business_features_admin" on business_features;
create policy "business_features_admin" on business_features for all using (is_super_admin());
create policy "business_features_read" on business_features for select using (business_id = get_my_business_id());

-- 9. TRIGGERS
create or replace function handle_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists tr_businesses_updated_at on businesses;
create trigger tr_businesses_updated_at before update on businesses for each row execute function handle_updated_at();

drop trigger if exists tr_locations_updated_at on locations;
create trigger tr_locations_updated_at before update on locations for each row execute function handle_updated_at();

drop trigger if exists tr_profiles_updated_at on profiles;
create trigger tr_profiles_updated_at before update on profiles for each row execute function handle_updated_at();

drop trigger if exists tr_employees_updated_at on employees;
create trigger tr_employees_updated_at before update on employees for each row execute function handle_updated_at();

drop trigger if exists tr_menu_items_updated_at on menu_items;
create trigger tr_menu_items_updated_at before update on menu_items for each row execute function handle_updated_at();

drop trigger if exists tr_tables_updated_at on tables;
create trigger tr_tables_updated_at before update on tables for each row execute function handle_updated_at();

drop trigger if exists tr_orders_updated_at on orders;
create trigger tr_orders_updated_at before update on orders for each row execute function handle_updated_at();

drop trigger if exists tr_inventory_items_updated_at on inventory_items;
create trigger tr_inventory_items_updated_at before update on inventory_items for each row execute function handle_updated_at();
