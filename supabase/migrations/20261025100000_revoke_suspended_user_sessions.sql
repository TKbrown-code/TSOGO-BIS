-- Revoking a refresh token is not enough to remove the corresponding Auth
-- session. Delete all session rows for a suspended user so they cannot refresh
-- their existing access token into a new one.
create or replace function public.revoke_user_auth_sessions(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_count integer;
begin
  delete from auth.sessions
  where user_id = target_user_id;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

revoke all on function public.revoke_user_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_auth_sessions(uuid) to service_role;
