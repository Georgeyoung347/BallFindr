// send-push: delivers one public.notifications row to the recipient's active
// native devices via APNs (iOS) and FCM HTTP v1 (Android).
//
// Called by the database trigger notifications_after_insert_push (pg_net) with
// POST {"notification_id": "<uuid>"} and header x-push-hook-secret. There is no
// JWT on that request, so supabase/config.toml sets verify_jwt = false and the
// secret is validated here through public.push_hook_secret_ok (service_role only).
//
// Everything that can be unit-tested lives in ./lib.ts.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  APNS_TOKEN_REASONS,
  apnsDeviceUrl,
  type ApnsEnv,
  apnsHeaders,
  apnsReason,
  buildApnsPayload,
  buildFcmMessage,
  buildJwt,
  describeError,
  type DeviceResult,
  FCM_SCOPE,
  fcmSendUrl,
  GOOGLE_TOKEN_URL,
  isApnsDeadToken,
  isFcmDeadToken,
  isUuid,
  type NotificationRow,
  nowSeconds,
  parseApnsEnv,
  parseFcmError,
  parseServiceAccount,
  pemToDer,
  type Platform,
  type PushDeviceRow,
  type PushPreferences,
  pushSkipReason,
  redactToken,
  type ServiceAccount,
  summarize,
  tokenHint,
} from "./lib.ts";

// ---------------------------------------------------------------------------
// Configuration (read once per isolate; secrets are injected by Supabase)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ApnsConfig {
  teamId: string;
  keyId: string;
  privateKeyPem: string;
  bundleId: string;
  env: ApnsEnv;
}

function readApnsConfig(): ApnsConfig | null {
  const teamId = Deno.env.get("APNS_TEAM_ID")?.trim();
  const keyId = Deno.env.get("APNS_KEY_ID")?.trim();
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY")?.trim();
  if (!teamId || !keyId || !privateKeyPem) return null;
  return {
    teamId,
    keyId,
    privateKeyPem,
    bundleId: Deno.env.get("APNS_BUNDLE_ID")?.trim() || "uk.co.ballfindr.app",
    env: parseApnsEnv(Deno.env.get("APNS_ENV")),
  };
}

function readFcmConfig(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw || !raw.trim()) return null;
  try {
    return parseServiceAccount(raw);
  } catch (e) {
    console.error("send-push: FCM_SERVICE_ACCOUNT_JSON is set but unusable:", errMsg(e));
    return null;
  }
}

const APNS = readApnsConfig();
const FCM = readFcmConfig();

// ---------------------------------------------------------------------------
// Provider credentials, cached in module scope for the life of the isolate

const APNS_JWT_TTL_MS = 50 * 60 * 1000; // Apple: refresh between 20 and 60 minutes
let apnsKeyPromise: Promise<CryptoKey> | null = null;
let apnsJwtCache: { jwt: string; issuedAt: number } | null = null;

async function apnsSigningKey(cfg: ApnsConfig): Promise<CryptoKey> {
  apnsKeyPromise ??= crypto.subtle.importKey(
    "pkcs8",
    pemToDer(cfg.privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  try {
    return await apnsKeyPromise;
  } catch (e) {
    apnsKeyPromise = null; // allow a later request to retry after a secret fix
    throw e;
  }
}

async function apnsProviderJwt(cfg: ApnsConfig, force = false): Promise<string> {
  const now = Date.now();
  if (!force && apnsJwtCache && now - apnsJwtCache.issuedAt < APNS_JWT_TTL_MS) return apnsJwtCache.jwt;
  const key = await apnsSigningKey(cfg);
  const jwt = await buildJwt(
    { alg: "ES256", kid: cfg.keyId },
    { iss: cfg.teamId, iat: nowSeconds(now) },
    async (data) => new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data)),
  );
  apnsJwtCache = { jwt, issuedAt: now };
  return jwt;
}

let fcmKeyPromise: Promise<CryptoKey> | null = null;
let fcmTokenCache: { accessToken: string; expiresAt: number } | null = null;
let fcmTokenInFlight: Promise<string> | null = null;

async function fcmSigningKey(sa: ServiceAccount): Promise<CryptoKey> {
  fcmKeyPromise ??= crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  try {
    return await fcmKeyPromise;
  } catch (e) {
    fcmKeyPromise = null;
    throw e;
  }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (fcmTokenCache && fcmTokenCache.expiresAt - 60_000 > now) return fcmTokenCache.accessToken;
  if (fcmTokenInFlight) return fcmTokenInFlight;
  fcmTokenInFlight = (async () => {
    try {
      const key = await fcmSigningKey(sa);
      const iat = nowSeconds(now);
      const tokenUrl = sa.token_uri ?? GOOGLE_TOKEN_URL;
      const assertion = await buildJwt(
        { alg: "RS256", typ: "JWT" },
        { iss: sa.client_email, scope: FCM_SCOPE, aud: tokenUrl, iat, exp: iat + 3600 },
        async (data) => new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data)),
      );
      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`oauth2 token endpoint ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
      if (!json.access_token) throw new Error("oauth2 token endpoint returned no access_token");
      const ttl = typeof json.expires_in === "number" ? json.expires_in : 3600;
      fcmTokenCache = { accessToken: json.access_token, expiresAt: now + ttl * 1000 };
      return json.access_token;
    } finally {
      fcmTokenInFlight = null;
    }
  })();
  return await fcmTokenInFlight;
}

// ---------------------------------------------------------------------------
// Sending

type SendOutcome = Omit<DeviceResult, "device_id" | "platform">;

async function sendApns(cfg: ApnsConfig, device: PushDeviceRow, n: NotificationRow): Promise<SendOutcome> {
  const payload = JSON.stringify(buildApnsPayload(n));
  const url = apnsDeviceUrl(cfg.env, device.token);
  for (let attempt = 0; attempt < 2; attempt++) {
    const jwt = await apnsProviderJwt(cfg, attempt > 0);
    const res = await fetch(url, { method: "POST", headers: apnsHeaders(jwt, cfg.bundleId, n.id), body: payload });
    if (res.ok) {
      await res.body?.cancel();
      return { status: "sent", http_status: res.status };
    }
    const reason = apnsReason(await res.text());
    if (attempt === 0 && reason && APNS_TOKEN_REASONS.has(reason)) continue; // refresh JWT once
    if (isApnsDeadToken(res.status, reason)) return { status: "deactivated", reason, http_status: res.status };
    return { status: "failed", reason: reason ?? `http_${res.status}`, http_status: res.status };
  }
  return { status: "failed", reason: "provider_token_retry_exhausted" };
}

async function sendFcm(sa: ServiceAccount, device: PushDeviceRow, n: NotificationRow): Promise<SendOutcome> {
  const accessToken = await fcmAccessToken(sa);
  const res = await fetch(fcmSendUrl(sa.project_id), {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ message: buildFcmMessage(device.token, n) }),
  });
  if (res.ok) {
    await res.body?.cancel();
    return { status: "sent", http_status: res.status };
  }
  const info = parseFcmError(await res.text());
  const reason = info.errorCode ?? info.status ?? `http_${res.status}`;
  if (res.status === 401) fcmTokenCache = null; // make the next call mint a fresh token
  if (isFcmDeadToken(res.status, info)) return { status: "deactivated", reason, http_status: res.status };
  return { status: "failed", reason, http_status: res.status };
}

async function deliver(device: PushDeviceRow, n: NotificationRow): Promise<DeviceResult> {
  const base = { device_id: device.id, platform: device.platform };
  try {
    if (device.platform === "ios") {
      if (!APNS) return { ...base, status: "skipped", reason: "apns_not_configured" };
      return { ...base, ...(await sendApns(APNS, device, n)) };
    }
    if (device.platform === "android") {
      if (!FCM) return { ...base, status: "skipped", reason: "fcm_not_configured" };
      return { ...base, ...(await sendFcm(FCM, device, n)) };
    }
    return { ...base, status: "skipped", reason: "unknown_platform" };
  } catch (e) {
    // fetch errors quote the request URL, which for APNs contains the device
    // token: redact it before it reaches the log or the stored response.
    const detail = redactToken(describeError(e), device.token);
    console.error(
      `send-push: ${device.platform} send failed for device ${device.id} (${tokenHint(device.token)}):`,
      detail,
    );
    return { ...base, status: "failed", reason: detail.slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------
// Database

async function markDevices(db: SupabaseClient, ids: string[], patch: Record<string, unknown>, what: string) {
  if (ids.length === 0) return;
  const { error } = await db.from("push_devices").update(patch).in("id", ids);
  if (error) console.error(`send-push: could not ${what} (${ids.length} device(s)):`, error.message);
}

// ---------------------------------------------------------------------------
// HTTP handler

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("send-push: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    return json({ error: "server_misconfigured" }, 500);
  }
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // 1. Shared-secret check (the trigger sends no JWT).
  const secret = req.headers.get("x-push-hook-secret") ?? "";
  if (!secret) return json({ error: "unauthorized" }, 401);
  const { data: secretOk, error: secretErr } = await db.rpc("push_hook_secret_ok", { _s: secret });
  if (secretErr) {
    console.error("send-push: push_hook_secret_ok failed:", secretErr.message);
    return json({ error: "unauthorized" }, 401);
  }
  if (secretOk !== true) return json({ error: "unauthorized" }, 401);

  // 2. Body.
  let notificationId: string;
  try {
    const body = (await req.json()) as { notification_id?: unknown };
    if (!isUuid(body?.notification_id)) return json({ error: "notification_id must be a uuid" }, 400);
    notificationId = body.notification_id;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // 3. Notification.
  const { data: notification, error: nErr } = await db
    .from("notifications")
    .select("id, recipient_profile_id, type, title, body, entity_type, entity_id, read_at")
    .eq("id", notificationId)
    .maybeSingle();
  if (nErr) {
    console.error("send-push: loading notification failed:", nErr.message);
    return json({ error: "notification_lookup_failed" }, 500);
  }
  if (!notification) return json({ error: "notification_not_found", notification_id: notificationId }, 404);
  const n = notification as NotificationRow;

  // 4. Preferences: category switches already gated the INSERT in the database;
  //    only the master push switch (and read state) are checked here.
  const { data: prefRow, error: pErr } = await db
    .from("notification_preferences")
    .select("push_enabled")
    .eq("profile_id", n.recipient_profile_id)
    .maybeSingle();
  if (pErr) console.error("send-push: loading preferences failed (treating as enabled):", pErr.message);
  const skip = pushSkipReason(n, (prefRow as PushPreferences | null) ?? null);
  if (skip) {
    return json({ notification_id: n.id, reason: skip, sent: 0, failed: 0, skipped: 0, deactivated: 0, devices: [] });
  }

  // 5. Devices.
  const { data: deviceRows, error: dErr } = await db
    .from("push_devices")
    .select("id, token, platform")
    .eq("user_id", n.recipient_profile_id)
    .eq("is_active", true);
  if (dErr) {
    console.error("send-push: loading push_devices failed:", dErr.message);
    return json({ error: "device_lookup_failed" }, 500);
  }
  const devices = ((deviceRows ?? []) as Array<{ id: string; token: string; platform: string }>)
    .filter((d) => d.platform === "ios" || d.platform === "android")
    .map((d) => ({ id: d.id, token: d.token, platform: d.platform as Platform }));
  if (devices.length === 0) {
    return json({
      notification_id: n.id,
      reason: "no_active_devices",
      sent: 0,
      failed: 0,
      skipped: 0,
      deactivated: 0,
      devices: [],
    });
  }

  // 6. Fan out.
  const settled = await Promise.allSettled(devices.map((d) => deliver(d, n)));
  const results: DeviceResult[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : {
      device_id: devices[i].id,
      platform: devices[i].platform,
      status: "failed",
      reason: redactToken(describeError(s.reason), devices[i].token).slice(0, 200),
    }
  );

  // 7. Housekeeping: retire dead tokens, record accepted pushes.
  const nowIso = new Date().toISOString();
  await Promise.all([
    markDevices(
      db,
      results.filter((r) => r.status === "deactivated").map((r) => r.device_id),
      { is_active: false, updated_at: nowIso },
      "deactivate dead tokens",
    ),
    markDevices(
      db,
      results.filter((r) => r.status === "sent").map((r) => r.device_id),
      { last_seen_at: nowIso },
      "update last_seen_at",
    ),
  ]);

  const summary = summarize(results);
  const platformsSkipped = [
    ...(APNS ? [] : ["ios"]),
    ...(FCM ? [] : ["android"]),
  ].filter((p) => devices.some((d) => d.platform === p));
  if (summary.failed > 0) {
    console.error(
      `send-push: ${summary.failed} delivery failure(s) for notification ${n.id}`,
      results.filter((r) => r.status === "failed"),
    );
  }
  return json({
    notification_id: n.id,
    ...summary,
    ...(platformsSkipped.length ? { not_configured: platformsSkipped } : {}),
    devices: results,
  });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("send-push: unhandled error:", errMsg(e));
    return json({ error: "internal_error" }, 500);
  }
});
