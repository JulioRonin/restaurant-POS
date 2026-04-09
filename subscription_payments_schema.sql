-- Table to track subscription payments for Culinex SaaS
create table if not exists public.subscription_payments (
    id uuid primary key default uuid_generate_v4(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    amount numeric(10, 2) not null,
    currency text default 'MXN',
    method text not null, -- 'stripe', 'transfer', etc.
    status text default 'PAID',
    stripe_link text,
    period_start timestamp with time zone not null,
    period_end timestamp with time zone not null,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.subscription_payments enable row level security;

-- Policies
create policy "Admins can view their own business payments" on public.subscription_payments
    for select using (business_id = get_my_business_id() and has_role('admin'));

-- Grant access to authenticated users (for insertion during payment flow)
create policy "Admins can record payments for their business" on public.subscription_payments
    for insert with check (business_id = get_my_business_id() and has_role('admin'));

-- Ensure businesses table update policy is explicitly granted
drop policy if exists "Admins can update their business" on public.businesses;
create policy "Admins can update their business" on public.businesses
  for update using (id = get_my_business_id() and has_role('admin'));
