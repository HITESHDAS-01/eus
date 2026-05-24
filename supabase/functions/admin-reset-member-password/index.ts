// Supabase Edge Function: admin-reset-member-password
// ---------------------------------------------------------------------------
// Lets an authenticated admin set a new password for any member.
// Required because we cannot call auth.admin.updateUserById from the browser
// without the service role key.
//
// Auth model:
//   - Caller must be an authenticated admin (verified via JWT + profiles.role).
//   - Service role key (from env) is used internally to call auth.admin APIs.
//
// Deploy:
//   supabase functions deploy admin-reset-member-password --no-verify-jwt=false
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ResetPasswordPayload = {
  member_id: string;
  new_password: string;
};

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

  let body: ResetPasswordPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.member_id || !body.new_password) {
    return new Response(
      JSON.stringify({ error: 'member_id and new_password are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (body.new_password.length < 6) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 6 characters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Safety check: the target must actually be a member (not another admin).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: targetProfile, error: targetErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', body.member_id)
    .single();

  if (targetErr || !targetProfile) {
    return new Response(JSON.stringify({ error: 'Member not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (targetProfile.role !== 'member') {
    return new Response(
      JSON.stringify({ error: 'Cannot reset password for non-member accounts via this endpoint' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(body.member_id, {
    password: body.new_password,
  });

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
