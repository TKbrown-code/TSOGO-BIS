-- Admin-only customer directory, including Auth emails unavailable through profiles.
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  phone text,
  preferred_language text,
  created_at timestamptz,
  is_admin boolean,
  order_count bigint,
  paid_total numeric,
  last_order_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select au.id,
    au.email::text,
    coalesce(nullif(p.display_name, ''), nullif(au.raw_user_meta_data ->> 'display_name', ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(au.email, ''), '@', 1), '')),
    coalesce(p.phone, au.phone)::text,
    coalesce(p.preferred_language, 'fr')::text,
    au.created_at,
    exists (select 1 from public.user_roles ur where ur.user_id = au.id and ur.role = 'admin'),
    coalesce(activity.order_count, 0)::bigint,
    coalesce(activity.paid_total, 0)::numeric,
    activity.last_order_at
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join lateral (
    select count(*)::bigint as order_count,
      coalesce(sum(c.total) filter (where c.payment_status in ('paid', 'succeeded', 'successful')), 0)::numeric as paid_total,
      max(c.created_at) as last_order_at
    from public.checkouts c
    where c.user_id = au.id
  ) activity on true
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
