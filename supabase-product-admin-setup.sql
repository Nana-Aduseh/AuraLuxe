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
$$;

grant execute on function public.is_admin_user() to authenticated, anon;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_quantities enable row level security;

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
  user_id uuid not null references auth.users(id) on delete cascade,
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  payment_reference text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

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
