-- Culinex POS - Multi-Tenant & Multi-Location SaaS Schema
-- Architecture for performance, scalability, and strict security isolation.

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. CORE TENANT TABLES
-- Root entity for each company using the SaaS
create table businesses (
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

-- Locations/Branches belonging to a business
create table locations (
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

-- Profiles linking Supabase Auth users to Businesses and Locations
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  role text not null check (role in ('admin', 'manager', 'cashier', 'waiter', 'kitchen')),
  full_name text,
  is_active boolean default true,
  onboarding_completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. FEATURE FLAGS SYSTEM
-- Modular functionality definition
create table features (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null, -- e.g., 'advanced_reporting', 'delivery_integrations'
  name text not null,
  description text,
  is_active boolean default true
);

-- Enabling features per business
create table business_features (
  business_id uuid not null references businesses(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  enabled boolean default false,
  config jsonb default '{}'::jsonb,
  primary key (business_id, feature_id)
);

-- 4. BUSINESS CORE TABLES (AUGMENTED)

-- Employees (Branch staff, distinct from profiles which are for login)
create table employees (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  role text not null,
  area text not null,
  status text default 'OFF_SHIFT',
  image text,
  rating numeric(3, 1) default 5.0,
  hours_worked numeric(10, 2) default 0,
  schedule jsonb,
  pin text, -- For local tablet login
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Menu Items (Tenant catalog)
create table menu_items (
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

-- Tables Mapping per Location
create table tables (
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

-- Orders per Location
create table orders (
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

-- Order details
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity int not null default 1,
  notes text,
  price_at_time numeric(10, 2) not null,
  created_at timestamp with time zone default now()
);

-- Inventory Tracking per Location
create table inventory_items (
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

-- 5. HELPER FUNCTIONS FOR RLS
-- Detect business_id of current session user
create or replace function get_my_business_id() 
returns uuid as $$
  select business_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- Detect location_id of current session user
create or replace function get_my_location_id() 
returns uuid as $$
  select location_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- Check if user has a specific role
create or replace function has_role(required_role text) 
returns boolean as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = required_role
  );
$$ language sql stable security definer;

-- 6. SECURITY - ENABLE RLS
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

-- 7. POLICIES (ISOLATION LAYER)

-- BUSINESSES: Only admins of that business can see/update it
create policy "Businesses are visible to their members" on businesses
  for select using (id = get_my_business_id());

create policy "Admins can update their business" on businesses
  for update using (id = get_my_business_id() and has_role('admin'));

-- LOCATIONS: Filtered by business_id
create policy "Locations are visible to business members" on locations
  for select using (business_id = get_my_business_id());

create policy "Admins can manage locations" on locations
  for all using (business_id = get_my_business_id() and has_role('admin'));

-- PROFILES: Users see themselves and admins see everyone in business
create policy "Profiles visibility" on profiles
  for select using (business_id = get_my_business_id());

create policy "Users can update own profile" on profiles
  for update using (id = auth.uid());

-- CORE DATA: Locked strictly via get_my_business_id()
-- Example for Orders
create policy "Strict isolation for orders" on orders
  for all using (business_id = get_my_business_id());

-- Multi-Location enforcement: Managers/Cashiers limited to their location_id
-- (Add location checks for non-admins if desired)
create policy "Location-based access for orders" on orders
  for select using (
    business_id = get_my_business_id() AND (
      has_role('admin') OR location_id = get_my_location_id()
    )
  );

-- MENU ITEMS: Shared across business
create policy "Menu items isolation" on menu_items
  for all using (business_id = get_my_business_id());

-- INVENTORY: Strictly per location unless admin
create policy "Inventory isolation" on inventory_items
  for all using (
    business_id = get_my_business_id() AND (
      has_role('admin') OR location_id = get_my_location_id()
    )
  );

-- 8. INDEXING FOR MULTI-TENANT PERFORMANCE
create index idx_orders_business_location on orders (business_id, location_id);
create index idx_inventory_business_location on inventory_items (business_id, location_id);
create index idx_menu_items_business on menu_items (business_id);
create index idx_profiles_business on profiles (business_id);
