import { createClient } from "npm:@supabase/supabase-js@2.33.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
function createServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createServiceClient>, email: string) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("Admin management is missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.");
    return respond({ error: "Admin management is not configured. Check the Edge Function secrets." }, 500);
  }

  const supabase = createServiceClient();

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) return respond({ error: "Authentication required" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  const caller = authData.user;
  if (authError || !caller) {
    console.error("Admin management could not validate the caller session:", authError);
    return respond({ error: "Your session could not be verified. Sign in again and retry." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: callerIsAdmin, error: roleError } = await callerClient.rpc("is_admin");
  if (roleError) {
    console.error("Admin management could not verify the caller through public.is_admin():", roleError);
    return respond({ error: "Could not verify administrator access. Confirm the is_admin function is deployed and executable by authenticated users." }, 500);
  }
  if (callerIsAdmin !== true) return respond({ error: "Admin access required" }, 403);

  let body: { action?: string; email?: string; user_id?: string };
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "suspend_user" || body.action === "restore_user") {
      const userId = body.user_id?.trim();
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return respond({ error: "A valid user ID is required" }, 400);
      }
      if (userId === caller.id) return respond({ error: "You cannot suspend your own account" }, 400);
      const { data: adminRole, error: adminRoleError } = await callerClient.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (adminRoleError) throw adminRoleError;
      if (adminRole) return respond({ error: "Administrator accounts cannot be suspended here" }, 400);
      const { data, error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: body.action === "suspend_user" ? "876000h" : "none" });
      if (error) throw error;
      return respond({ success: true, user_id: userId, banned_until: data.user?.banned_until ?? null });
    }

    if (body.action === "list") {
      const { data: roles, error } = await callerClient
        .from("user_roles")
        .select("user_id, role, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const users = await Promise.all((roles ?? []).map(async (role) => {
        const { data, error: userError } = await supabase.auth.admin.getUserById(role.user_id);
        if (userError) return { ...role, email: null, display_name: null };
        return {
          ...role,
          email: data.user.email ?? null,
          display_name: String(data.user.user_metadata?.display_name ?? "") || null,
        };
      }));
      return respond({ admins: users });
    }

    if (body.action === "add") {
      const email = body.email?.trim().toLowerCase();
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return respond({ error: "Enter a valid email address" }, 400);
      }

      let user = await findAuthUserByEmail(supabase, email);
      let invited = false;
      if (!user) {
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
        if (error) throw error;
        user = data.user;
        invited = true;
      }
      if (!user) throw new Error("Could not create or find the Auth user");

      const { error } = await callerClient.from("user_roles").upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
      if (error) throw error;

      return respond({ admin: { user_id: user.id, email: user.email, role: "admin" }, invited });
    }

    if (body.action === "remove") {
      const userId = body.user_id?.trim();
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return respond({ error: "A valid user ID is required" }, 400);
      }
      if (userId === caller.id) return respond({ error: "You cannot remove your own admin access" }, 400);

      const { data: admins, error: adminsError } = await callerClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (adminsError) throw adminsError;
      if ((admins ?? []).length <= 1) return respond({ error: "The last admin cannot be removed" }, 400);

      const { error } = await callerClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("Admin management failed:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return respond({ error: "Admin management request failed", detail }, 500);
  }
});
