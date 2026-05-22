create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
      and confirmation_status = 'confirmed';
$$;

grant execute on function public.is_admin_user() to authenticated, anon;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_quantities enable row level security;

alter table public.products
  add column if not exists promo_enabled boolean not null default false,
  add column if not exists original_price numeric,
  add column if not exists discounted_price numeric;

drop policy if exists "Users can view profiles" on public.profiles;
create policy "Users can view profiles"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin_user()
);

drop policy if exists "Users can insert profiles" on public.profiles;
create policy "Users can insert profiles"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  or public.is_admin_user()
);

drop policy if exists "Users can update profiles" on public.profiles;
create policy "Users can update profiles"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_admin_user()
)
with check (
  auth.uid() = id
  or public.is_admin_user()
);

drop policy if exists "Public can view products" on public.products;
create policy "Public can view products"
on public.products
for select
using (true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
on public.products
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

alter table public.product_colors
  add column if not exists image_url text;

drop policy if exists "Public can view product colors" on public.product_colors;
create policy "Public can view product colors"
on public.product_colors
for select
using (true);

drop policy if exists "Admins can manage product colors" on public.product_colors;
create policy "Admins can manage product colors"
on public.product_colors
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public can view product quantities" on public.product_quantities;
create policy "Public can view product quantities"
on public.product_quantities
for select
using (true);

drop policy if exists "Admins can manage product quantities" on public.product_quantities;
create policy "Admins can manage product quantities"
on public.product_quantities
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
)
with check (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

-- Orders Table and RLS
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  payment_reference text unique,
  guest_access_token text unique,
  guest_first_name text,
  guest_last_name text,
  guest_email text,
  guest_phone text,
  guest_address text,
  guest_town text,
  guest_region text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.orders
  alter column user_id drop not null,
  add column if not exists guest_access_token text unique,
  add column if not exists guest_first_name text,
  add column if not exists guest_last_name text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text,
  add column if not exists guest_address text,
  add column if not exists guest_town text,
  add column if not exists guest_region text,
  add column if not exists order_type text default 'delivery' check (order_type in ('delivery', 'pickup')),
  add column if not exists confirmation_status text default 'not_confirmed' check (confirmation_status in ('not_confirmed', 'confirmed')),
  add column if not exists completed_at timestamp with time zone;

alter table public.orders enable row level security;

drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert orders" on public.orders;
create policy "Users can insert orders"
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own orders" on public.orders;
create policy "Users can update own orders"
on public.orders
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
on public.orders
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

-- Cart Items Table and RLS
create table if not exists public.cart_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.product_colors(id) on delete cascade,
  quantity_id uuid not null references public.product_quantities(id) on delete cascade,
  quantity_ordered integer not null default 1 check (quantity_ordered > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, product_id, color_id, quantity_id)
);

alter table public.cart_items enable row level security;

drop policy if exists "Users can view own cart" on public.cart_items;
create policy "Users can view own cart"
on public.cart_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert into own cart" on public.cart_items;
create policy "Users can insert into own cart"
on public.cart_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own cart" on public.cart_items;
create policy "Users can update own cart"
on public.cart_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete from own cart" on public.cart_items;
create policy "Users can delete from own cart"
on public.cart_items
for delete
to authenticated
using (auth.uid() = user_id);

-- Order Items Table and RLS
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  color_id uuid not null references public.product_colors(id),
  quantity_id uuid not null references public.product_quantities(id),
  quantity_ordered integer not null default 1 check (quantity_ordered > 0),
  price_at_purchase numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.order_items enable row level security;

drop policy if exists "Users can insert own order items" on public.order_items;
create policy "Users can insert own order items"
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
    and orders.user_id = auth.uid()
  )
);

drop policy if exists "Users can view own order items" on public.order_items;
create policy "Users can view own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
    and orders.user_id = auth.uid()
  )
);

drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items"
on public.order_items
for select
to authenticated
using (public.is_admin_user());

-- User Addresses Table and RLS
create table if not exists public.user_addresses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  address text not null,
  town text not null,
  region text not null,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.user_addresses enable row level security;

drop policy if exists "Users can view own address" on public.user_addresses;
create policy "Users can view own address"
on public.user_addresses
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own address" on public.user_addresses;
create policy "Users can insert own address"
on public.user_addresses
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own address" on public.user_addresses;
create policy "Users can update own address"
on public.user_addresses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Admins can view all addresses" on public.user_addresses;
create policy "Admins can view all addresses"
on public.user_addresses
for select
to authenticated
using (public.is_admin_user());

create or replace function public.create_guest_order(
  p_cart_items jsonb,
  p_total_amount numeric,
  p_delivery_type text,
  p_guest_info jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  item jsonb;
  product_row public.products%rowtype;
  resolved_price numeric;
  quantity_ordered integer;
  color_uuid uuid;
  quantity_uuid uuid;
begin
  if p_guest_info is null then
    raise exception 'Guest information is required';
  end if;

  if p_cart_items is null or jsonb_array_length(p_cart_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders (
    user_id,
    total_amount,
    status,
    payment_reference,
    order_type,
    confirmation_status,
    guest_access_token,
    guest_first_name,
    guest_last_name,
    guest_email,
    guest_phone,
    guest_address,
    guest_town,
    guest_region
  )
  values (
    null,
    coalesce(p_total_amount, 0),
    'pending',
    'GUEST-' || extract(epoch from now())::bigint,
    case when p_delivery_type = 'pickup' then 'pickup' else 'delivery' end,
    'not_confirmed',
    gen_random_uuid()::text,
    p_guest_info->>'firstName',
    p_guest_info->>'lastName',
    p_guest_info->>'email',
    p_guest_info->>'phone',
    p_guest_info->>'address',
    p_guest_info->>'town',
    p_guest_info->>'region'
  )
  returning * into order_row;

  for item in select element.value from jsonb_array_elements(p_cart_items) as element(value)
  loop
    quantity_ordered := coalesce(nullif(item->>'quantity_ordered', '')::integer, 1);
    color_uuid := nullif(item->>'color_id', '')::uuid;
    quantity_uuid := nullif(item->>'quantity_id', '')::uuid;

    if color_uuid is null or quantity_uuid is null then
      raise exception 'Guest cart items must include a color and quantity';
    end if;

    select *
    into product_row
    from public.products
    where id = (item->>'product_id')::uuid;

    if not found then
      raise exception 'Product not found';
    end if;

    resolved_price := case
      when product_row.promo_enabled
        and product_row.discounted_price is not null
        and product_row.discounted_price > 0
      then product_row.discounted_price
      else product_row.price
    end;

    insert into public.order_items (
      order_id,
      product_id,
      color_id,
      quantity_id,
      quantity_ordered,
      price_at_purchase
    )
    values (
      order_row.id,
      product_row.id,
      color_uuid,
      quantity_uuid,
      quantity_ordered,
      resolved_price
    );

    update public.product_quantities
    set stock_quantity = stock_quantity - quantity_ordered
    where id = quantity_uuid;
  end loop;

  return jsonb_build_object(
    'order', to_jsonb(order_row),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'color_id', oi.color_id,
            'quantity_id', oi.quantity_id,
            'quantity_ordered', oi.quantity_ordered,
            'price_at_purchase', oi.price_at_purchase,
            'product', jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'price', p.price,
              'image_url', p.image_url
            ),
            'color', jsonb_build_object(
              'id', c.id,
              'color_name', c.color_name,
              'color_hex', c.color_hex,
              'image_url', c.image_url
            ),
            'quantity_data', jsonb_build_object(
              'id', q.id,
              'length_inches', q.length_inches,
              'stock_quantity', q.stock_quantity
            )
          )
          order by oi.created_at asc
        )
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        left join public.product_colors c on c.id = oi.color_id
        left join public.product_quantities q on q.id = oi.quantity_id
        where oi.order_id = order_row.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.create_guest_order(jsonb, numeric, text, jsonb) to anon, authenticated;

create or replace function public.get_guest_order(
  p_order_id uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  select *
  into order_row
  from public.orders
  where id = p_order_id
    and guest_access_token = p_token
    and confirmation_status = 'confirmed';

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(order_row),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'color_id', oi.color_id,
            'quantity_id', oi.quantity_id,
            'quantity_ordered', oi.quantity_ordered,
            'price_at_purchase', oi.price_at_purchase,
            'product', jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'price', p.price,
              'image_url', p.image_url
            ),
            'color', jsonb_build_object(
              'id', c.id,
              'color_name', c.color_name,
              'color_hex', c.color_hex,
              'image_url', c.image_url
            ),
            'quantity_data', jsonb_build_object(
              'id', q.id,
              'length_inches', q.length_inches,
              'stock_quantity', q.stock_quantity
            )
          )
          order by oi.created_at asc
        )
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        left join public.product_colors c on c.id = oi.color_id
        left join public.product_quantities q on q.id = oi.quantity_id
        where oi.order_id = order_row.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_guest_order(uuid, text) to anon, authenticated;

create or replace function public.claim_guest_orders(
  p_guest_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  claimed_orders jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email
  into current_email
  from auth.users
  where id = current_user_id;

  with claimed as (
    update public.orders o
    set user_id = current_user_id,
        updated_at = timezone('utc'::text, now())
    where o.user_id is null
      and o.confirmation_status = 'confirmed'
      and (
        (current_email is not null and lower(btrim(coalesce(o.guest_email, ''))) = lower(btrim(current_email)))
        or (p_guest_token is not null and o.guest_access_token = p_guest_token)
      )
    returning to_jsonb(o)
  )
  select coalesce(jsonb_agg(claimed), '[]'::jsonb)
  into claimed_orders
  from claimed;

  return jsonb_build_object(
    'claimed_count', coalesce(jsonb_array_length(claimed_orders), 0),
    'orders', claimed_orders
  );
end;
$$;

grant execute on function public.claim_guest_orders(text) to authenticated;

create or replace function public.get_customer_orders(
  p_guest_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email
  into current_email
  from auth.users
  where id = current_user_id;

  return coalesce(
    (
      select jsonb_agg(
        to_jsonb(o)
        order by o.created_at desc
      )
      from public.orders o
      where o.confirmation_status = 'confirmed'
        and (
          o.user_id = current_user_id
          or (
            current_email is not null
            and lower(btrim(coalesce(o.guest_email, ''))) = lower(btrim(current_email))
          )
          or (p_guest_token is not null and o.guest_access_token = p_guest_token)
        )
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_customer_orders(text) to authenticated;
