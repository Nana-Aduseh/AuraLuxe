-- Soft delete support for products.
-- Products that have been ordered cannot be hard-deleted because order_items
-- references products/product_colors/product_quantities without ON DELETE CASCADE
-- (order history must be preserved). Instead of deleting, we mark products as
-- deleted and hide them from the storefront and admin product list.

alter table if exists public.products
  add column if not exists is_deleted boolean not null default false;

update public.products
set is_deleted = false
where is_deleted is null;
