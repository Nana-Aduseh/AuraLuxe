create table if not exists public.product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.product_images enable row level security;

drop policy if exists "Public can view product images" on public.product_images;
create policy "Public can view product images"
on public.product_images
for select
using (true);

drop policy if exists "Admins can manage product images" on public.product_images;
create policy "Admins can manage product images"
on public.product_images
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());