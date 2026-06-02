alter table if exists public.products
  add column if not exists product_type text not null default 'extension' check (product_type in ('extension', 'product'));

update public.products
set product_type = 'extension'
where product_type is null;
