-- Add order delivery and confirmation fields
ALTER TABLE public.orders
ADD COLUMN order_type text default 'delivery' check (order_type in ('delivery', 'pickup')),
ADD COLUMN confirmation_status text default 'not_confirmed' check (confirmation_status in ('not_confirmed', 'confirmed')),
ADD COLUMN delivery_status text default null check (delivery_status is null or delivery_status in ('sent', 'received'));

-- Create index for better query performance
CREATE INDEX idx_orders_confirmation_status ON public.orders(confirmation_status);
CREATE INDEX idx_orders_delivery_status ON public.orders(delivery_status);
CREATE INDEX idx_orders_order_type ON public.orders(order_type);
