// Supabase Edge Function: admin-create-member
// ---------------------------------------------------------------------------
// Provisions an auth.users entry + profiles row + members row in one shot.
// Required because we cannot create auth.users from the browser without
// signing the new user in (which would log the admin out).
//
// Auth model:
//   - Caller must be an authenticated admin (verified via JWT + profiles.role).
//   - Service role key (from env) is used internally to call auth.admin APIs.
//   - The synthetic login email is `<sanitized_code>@members.local`.
//
// Deploy:
//   supabase functions deploy admin-create-member --no-verify-jwt=false
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MEMBER_EMAIL_DOMAIN = Deno.env.get('MEMBER_EMAIL_DOMAIN') ?? 'members.local';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CreateMemberPayload = {
  full_name: string;
  phone?: string | null;
  photo_url?: string | null;
  member_code?: string | null;
  category: 'A' | 'B' | 'C';
  initial_investment?: number;
  monthly_installment?: number | null;
  chosen_term_months?: number | null;
  join_date?: string;
  password: string;
};

function syntheticEmail(memberCode: string): string {
  const sanitized = memberCode.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  return `${sanitized}@${MEMBER_EMAIL_DOMAIN}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify caller is an admin using their JWT.
  const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: admins only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: CreateMemberPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.full_name || !body.category || !body.password) {
    return new Response(
      JSON.stringify({ error: 'full_name, category, and password are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (body.password.length < 6) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 6 characters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Generate the member_code up-front so the synthetic email is deterministic.
  // If admin supplied a code, use it; otherwise fall back to the DB trigger
  // (we'll re-read it after insert).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let providedCode = body.member_code?.trim() || null;
  let codeForEmail = providedCode;

  if (!codeForEmail) {
    // Preview what the trigger will assign: org prefix + MMYYYY + cat + 3-digit seq.
    const { data: prefixRow } = await admin
      .from('app_text_settings')
      .select('value')
      .eq('key', 'member_code_prefix')
      .single();
    const prefix = prefixRow?.value ?? 'EUS';
    const join = body.join_date ? new Date(body.join_date) : new Date();
    const mmYYYY = `${String(join.getMonth() + 1).padStart(2, '0')}${join.getFullYear()}`;
    const { count } = await admin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('category', body.category)
      .gte('join_date', `${join.getFullYear()}-${String(join.getMonth() + 1).padStart(2, '0')}-01`);
    const seq = String((count ?? 0) + 1).padStart(3, '0');
    codeForEmail = `${prefix}/${mmYYYY}/${body.category}/${seq}`;
  }

  const email = syntheticEmail(codeForEmail);

  // 1. Create auth user (service role, no email confirmation needed).
  let { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name, member_code: codeForEmail },
  });

  // If the email is already taken (orphaned auth user from a previous delete),
  // find and remove the orphan, then retry the create.
  if (createErr && (createErr.message?.toLowerCase().includes('already') || createErr.message?.toLowerCase().includes('registered'))) {
    try {
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
      });
      const listData = await listRes.json();
      const orphan = (listData.users ?? []).find((u: { email: string; id: string }) => u.email === email);
      if (orphan) {
        // Delete any leftover profile row (member row is already gone from our delete flow).
        await admin.from('profiles').delete().eq('id', orphan.id);
        await admin.auth.admin.deleteUser(orphan.id);
      }
    } catch (_) { /* ignore cleanup errors — retry will surface real issues */ }

    // Retry
    const retry = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, member_code: codeForEmail },
    });
    created = retry.data;
    createErr = retry.error;
  }

  if (createErr || !created?.user) {
    return new Response(JSON.stringify({ error: createErr?.message ?? 'createUser failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const newId = created.user.id;

  // 2. Insert profile (role=member).
  const { error: profileErr } = await admin.from('profiles').insert({
    id: newId,
    full_name: body.full_name,
    phone: body.phone || null,
    photo_url: body.photo_url || null,
    role: 'member',
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(newId);
    return new Response(JSON.stringify({ error: `Profile insert failed: ${profileErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. Insert member.
  const { data: memberRow, error: memberErr } = await admin
    .from('members')
    .insert({
      id: newId,
      member_code: providedCode ?? undefined,
      category: body.category,
      initial_investment: body.initial_investment ?? 0,
      monthly_installment: body.monthly_installment ?? null,
      chosen_term_months: body.chosen_term_months ?? null,
      join_date: body.join_date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (memberErr || !memberRow) {
    await admin.auth.admin.deleteUser(newId);
    return new Response(JSON.stringify({ error: `Member insert failed: ${memberErr?.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      id: newId,
      member_code: memberRow.member_code,
      login_email: email,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
