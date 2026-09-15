alter table public.orders
  add column if not exists sms_sent_at timestamp with time zone,
  add column if not exists sms_status text,
  add column if not exists sms_message_id text,
  add column if not exists sms_error text;