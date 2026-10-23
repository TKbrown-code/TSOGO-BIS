-- Publish delivery-related row changes for the admin and customer dashboards.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkouts'
  ) then
    alter publication supabase_realtime add table public.checkouts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shipments'
  ) then
    alter publication supabase_realtime add table public.shipments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shipment_events'
  ) then
    alter publication supabase_realtime add table public.shipment_events;
  end if;
end;
$$;

-- Public tracking pages cannot subscribe to private checkout rows. Broadcast
-- only the tracking code and delivery status; clients fetch the remaining
-- tracking information through the existing track_shipment RPC.
create or replace function public.broadcast_delivery_status_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tracking_number is not null then
    perform realtime.send(
      jsonb_build_object(
        'tracking_number', new.tracking_number,
        'status', new.status,
        'estimated_delivery', new.estimated_delivery
      ),
      'delivery_status_updated',
      'delivery:' || new.tracking_number,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists shipments_broadcast_delivery_status on public.shipments;
create trigger shipments_broadcast_delivery_status
after update of status, estimated_delivery on public.shipments
for each row
when (old.status is distinct from new.status or old.estimated_delivery is distinct from new.estimated_delivery)
execute function public.broadcast_delivery_status_update();

revoke all on function public.broadcast_delivery_status_update() from public, anon, authenticated;
