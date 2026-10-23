create schema if not exists private;

create table if not exists private.password_reset_rate_limits (
  bucket_hash text primary key check (bucket_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists password_reset_rate_limits_updated_at_idx
  on private.password_reset_rate_limits (updated_at);

revoke all on table private.password_reset_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_password_reset_rate_limit(p_bucket_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt_count integer;
begin
  if p_bucket_hash is null or p_bucket_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from private.password_reset_rate_limits
  where updated_at < now() - interval '1 day';

  insert into private.password_reset_rate_limits as current_bucket
    (bucket_hash, window_started_at, attempt_count, updated_at)
  values (p_bucket_hash, now(), 1, now())
  on conflict (bucket_hash) do update
    set window_started_at = case
          when current_bucket.window_started_at <= now() - interval '15 minutes' then now()
          else current_bucket.window_started_at
        end,
        attempt_count = case
          when current_bucket.window_started_at <= now() - interval '15 minutes' then 1
          else current_bucket.attempt_count + 1
        end,
        updated_at = now()
  returning attempt_count into current_attempt_count;

  return current_attempt_count <= 4;
end;
$$;

revoke all on function public.consume_password_reset_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_password_reset_rate_limit(text) to service_role;
