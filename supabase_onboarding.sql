-- Culinex POS - Multi-Tenant Onboarding Logic
-- Handles atomic creation of Business, Location, and Admin Profile.

-- Function to Onboard a New Business
-- To be called after a user signs up via Supabase Auth
create or replace function onboard_new_business(
  business_name text,
  admin_full_name text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  new_business_id uuid;
  new_location_id uuid;
  user_id uuid := auth.uid();
begin
  -- 1. Validation
  if user_id is null then
    raise exception 'Unauthorized. Must be authenticated to onboard.';
  end if;

  if exists (select 1 from public.profiles where id = user_id) then
    raise exception 'User already has a profile or business assigned.';
  end if;

  -- 2. Create the Business
  insert into public.businesses (name, plan)
  values (business_name, 'basic')
  returning id into new_business_id;

  -- 3. Create the Main/Initial Location
  insert into public.locations (business_id, name, address)
  values (new_business_id, 'Sucursal Principal', 'Dirección por definir')
  returning id into new_location_id;

  -- 4. Create the Admin Profile for the registered user
  insert into public.profiles (id, business_id, location_id, role, full_name)
  values (user_id, new_business_id, new_location_id, 'admin', admin_full_name);

  -- 5. Enable Default Features for the new business
  insert into public.business_features (business_id, feature_id, enabled)
  select new_business_id, id, true 
  from public.features 
  where key in ('basic_pos', 'inventory_management');

  return jsonb_build_object(
    'business_id', new_business_id,
    'location_id', new_location_id,
    'status', 'success'
  );
end;
$$;

-- Helper to track profile updates
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to main tables
create trigger tr_businesses_updated_at before update on businesses for each row execute function handle_updated_at();
create trigger tr_locations_updated_at before update on locations for each row execute function handle_updated_at();
create trigger tr_profiles_updated_at before update on profiles for each row execute function handle_updated_at();
create trigger tr_employees_updated_at before update on employees for each row execute function handle_updated_at();
create trigger tr_menu_items_updated_at before update on menu_items for each row execute function handle_updated_at();
create trigger tr_tables_updated_at before update on tables for each row execute function handle_updated_at();
create trigger tr_orders_updated_at before update on orders for each row execute function handle_updated_at();
create trigger tr_inventory_items_updated_at before update on inventory_items for each row execute function handle_updated_at();
