-- Keep the admin role lookup separate from admin authorization so admins can
-- reach the TOTP gate, while every existing public.is_admin() policy and RPC
-- requires an authenticator-app verified aal2 session.
create or replace function private.is_admin_totp_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(coalesce((select auth.jwt() -> 'amr'), '[]'::jsonb)) as method(value)
      where method.value ->> 'method' = 'totp'
    );
$$;

revoke all on function private.is_admin_totp_verified() from public, anon;
grant execute on function private.is_admin_totp_verified() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin_totp_verified();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- This role-only check is used only to route admins to the MFA gate and to
-- prevent admins from placing customer orders before they finish MFA.
create or replace function public.is_admin_role()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin_role() from public, anon;
grant execute on function public.is_admin_role() to authenticated;
