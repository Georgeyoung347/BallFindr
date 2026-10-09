// Pure, dependency-free helpers for the send-push edge function.
// Everything here is deterministic and testable without network or Deno APIs
// beyond WebCrypto-compatible byte handling. index.ts wires these into the
// Supabase client, APNs and FCM.

// ---------------------------------------------------------------------------
// Types

/** The notification row as loaded from public.notifications. */
export interface NotificationRow {
  id: string;
  recipient_profile_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
}

/** The subset of public.notification_preferences that gates push. */
export interface PushPreferences {
  push_enabled: boolean;
}

export type Platform = "ios" | "android";

/** An active row from public.push_devices. */
export interface PushDeviceRow {
  id: string;
  token: string;
  platform: Platform;
}

export type DeviceStatus = "sent" | "failed" | "skipped" | "deactivated";

/** Per-device outcome reported in the response. Tokens are never included. */
export interface DeviceResult {
  device_id: string;
  platform: Platform;
  status: DeviceStatus;
  /** Provider reason (APNs `reason`, FCM `status`/`errorCode`) or a local reason. */
  reason?: string;
  /** HTTP status returned by the provider, when a request was made. */
  http_status?: number;
}

export interface Summary {
  sent: number;
  failed: number;
  skipped: number;
  deactivated: number;
}

export interface ApnsPayload {
  aps: {
    alert: { title: string; body?: string };
    sound: "default";
  };
  notification_id: string;
  entity_type?: string;
  entity_id?: string;
}

export interface FcmMessage {
  token: string;
  notification: { title: string; body?: string };
  data: Record<string, string>;
  android: { priority: "high" };
}

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto's BufferSource params require. */
export type Bytes = Uint8Array<ArrayBuffer>;

export type SignFn = (data: Bytes) => Promise<Bytes>;

// ---------------------------------------------------------------------------
// Encoding

const encoder = new TextEncoder();

export function utf8(s: string): Bytes {
  return encoder.encode(s);
}

function toBytes(input: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof input === "string") return utf8(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return input;
}

/** Standard base64 -> bytes. Tolerates whitespace and missing padding. */
export function base64Decode(b64: string): Bytes {
  const clean = b64.replace(/\s+/g, "");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** bytes/string -> base64url without padding (RFC 7515 section 2). */
export function base64UrlEncode(input: Uint8Array | ArrayBuffer | string): string {
  const bytes = toBytes(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** base64url (padded or not) -> bytes. */
export function base64UrlDecode(s: string): Bytes {
  return base64Decode(s.replace(/-/g, "+").replace(/_/g, "/"));
}

// ---------------------------------------------------------------------------
// PEM

/**
 * Strip a PEM envelope and return the DER bytes. Accepts the `\n` escaped
 * form that secrets set from a shell often end up in, CRLF line endings, and
 * any BEGIN/END label (PRIVATE KEY, EC PRIVATE KEY, ...). Throws on empty input.
 */
export function pemToDer(pem: string): Bytes {
  const normalised = pem.replace(/\\n/g, "\n").replace(/\r/g, "");
  const body = normalised
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("PEM body is empty");
  return base64Decode(body);
}

// ---------------------------------------------------------------------------
// JWT

/** Build a compact JWS (header.payload.signature) using the supplied signer. */
export async function buildJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  sign: SignFn,
): Promise<string> {
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await sign(utf8(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/** Seconds since the Unix epoch, as JWT claims expect. */
export function nowSeconds(now: number = Date.now()): number {
  return Math.floor(now / 1000);
}

// ---------------------------------------------------------------------------
// Payloads

function compactString(v: string | null | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * APNs alert payload. `notification_id` sits at the top level of the payload
 * (Capacitor exposes custom keys as `notification.data` on iOS), which is what
 * src/lib/push-devices.ts reads on tap.
 */
export function buildApnsPayload(n: NotificationRow): ApnsPayload {
  const alert: ApnsPayload["aps"]["alert"] = { title: n.title };
  const body = compactString(n.body);
  if (body !== undefined) alert.body = body;
  const payload: ApnsPayload = { aps: { alert, sound: "default" }, notification_id: n.id };
  const entityType = compactString(n.entity_type);
  const entityId = compactString(n.entity_id);
  if (entityType !== undefined) payload.entity_type = entityType;
  if (entityId !== undefined) payload.entity_id = entityId;
  return payload;
}

/**
 * FCM HTTP v1 message. `data` values must all be strings; null fields are
 * omitted rather than sent as "null"/"".
 */
export function buildFcmMessage(token: string, n: NotificationRow): FcmMessage {
  const notification: FcmMessage["notification"] = { title: n.title };
  const body = compactString(n.body);
  if (body !== undefined) notification.body = body;
  const data: Record<string, string> = { notification_id: String(n.id) };
  const entityType = compactString(n.entity_type);
  const entityId = compactString(n.entity_id);
  if (entityType !== undefined) data.entity_type = entityType;
  if (entityId !== undefined) data.entity_id = entityId;
  return { token, notification, data, android: { priority: "high" } };
}

// ---------------------------------------------------------------------------
// Provider endpoints and headers

export type ApnsEnv = "production" | "sandbox";

/** Normalise APNS_ENV. Anything that is not clearly sandbox/development is production. */
export function parseApnsEnv(raw: string | undefined): ApnsEnv {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "sandbox" || v === "development" || v === "dev" ? "sandbox" : "production";
}

export function apnsBaseUrl(env: ApnsEnv): string {
  return env === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
}

export function apnsDeviceUrl(env: ApnsEnv, token: string): string {
  return `${apnsBaseUrl(env)}/3/device/${encodeURIComponent(token)}`;
}

export function apnsHeaders(jwt: string, topic: string, collapseId?: string): Record<string, string> {
  const h: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    "apns-topic": topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
  if (collapseId) h["apns-collapse-id"] = collapseId.slice(0, 64);
  return h;
}

export function fcmSendUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Parse FCM_SERVICE_ACCOUNT_JSON. Accepts the raw JSON document or the same
 * document base64-encoded (handy when a secret store mangles newlines).
 */
export function parseServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = JSON.parse(new TextDecoder().decode(base64Decode(trimmed)));
  }
  const obj = parsed as Record<string, unknown>;
  const project_id = obj?.project_id;
  const client_email = obj?.client_email;
  const private_key = obj?.private_key;
  if (typeof project_id !== "string" || !project_id) throw new Error("service account: missing project_id");
  if (typeof client_email !== "string" || !client_email) throw new Error("service account: missing client_email");
  if (typeof private_key !== "string" || !private_key) throw new Error("service account: missing private_key");
  const token_uri = typeof obj.token_uri === "string" && obj.token_uri ? obj.token_uri : undefined;
  return { project_id, client_email, private_key, token_uri };
}

// ---------------------------------------------------------------------------
// Dead-token decisions

export const APNS_DEAD_REASONS: ReadonlySet<string> = new Set([
  "BadDeviceToken",
  "Unregistered",
  "DeviceTokenNotForTopic",
]);

/** Reasons that mean our provider JWT is bad, not the device: refresh and retry once. */
export const APNS_TOKEN_REASONS: ReadonlySet<string> = new Set(["ExpiredProviderToken", "InvalidProviderToken"]);

/** True when APNs told us this device token will never work again. */
export function isApnsDeadToken(status: number, reason: string | null | undefined): boolean {
  if (status === 410) return true;
  return typeof reason === "string" && APNS_DEAD_REASONS.has(reason);
}

/** Extract `reason` from an APNs error body (JSON text or already parsed). */
export function apnsReason(body: unknown): string | undefined {
  let obj: unknown = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  const r = (obj as { reason?: unknown } | null)?.reason;
  return typeof r === "string" ? r : undefined;
}

export interface FcmErrorInfo {
  /** google.rpc.Status string, e.g. UNREGISTERED, INVALID_ARGUMENT. */
  status?: string;
  /** FcmError.errorCode from details, when present. */
  errorCode?: string;
  message?: string;
  /** Fields named in BadRequest.fieldViolations. */
  fields: string[];
}

/** Pull the useful bits out of an FCM v1 error body (JSON text or parsed). */
export function parseFcmError(body: unknown): FcmErrorInfo {
  let obj: unknown = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body);
    } catch {
      return { message: body.slice(0, 200), fields: [] };
    }
  }
  const err = (obj as { error?: Record<string, unknown> } | null)?.error;
  const info: FcmErrorInfo = { fields: [] };
  if (!err || typeof err !== "object") return info;
  if (typeof err.status === "string") info.status = err.status;
  if (typeof err.message === "string") info.message = err.message;
  const details = Array.isArray(err.details) ? err.details : [];
  for (const d of details as Record<string, unknown>[]) {
    if (typeof d?.errorCode === "string" && !info.errorCode) info.errorCode = d.errorCode;
    const violations = Array.isArray(d?.fieldViolations) ? d.fieldViolations : [];
    for (const v of violations as Record<string, unknown>[]) {
      if (typeof v?.field === "string") info.fields.push(v.field);
    }
  }
  return info;
}

/**
 * True when FCM says the registration token is gone or malformed:
 * 404 UNREGISTERED, or 400 INVALID_ARGUMENT whose message or field
 * violations name the token (a 400 about any other field is a payload bug,
 * not a dead device).
 */
export function isFcmDeadToken(status: number, info: FcmErrorInfo): boolean {
  const code = info.errorCode ?? info.status;
  if (status === 404 && (code === "UNREGISTERED" || code === "NOT_FOUND")) return true;
  if (status === 400 && code === "INVALID_ARGUMENT") {
    if (info.fields.some((f) => /(^|\.)token$/i.test(f))) return true;
    if (info.message && /registration token|device token|\btoken\b/i.test(info.message)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Gating and summarising

export type SkipReason = "push_disabled" | "already_read";

/**
 * Decide whether a notification should go out as a push at all. Category
 * preferences are enforced in the database before the row exists (see
 * private.notification_before_insert), so only the master switch and
 * read state are checked here. No preference row means push is on.
 */
export function pushSkipReason(n: Pick<NotificationRow, "read_at">, prefs: PushPreferences | null): SkipReason | null {
  if (prefs && prefs.push_enabled === false) return "push_disabled";
  if (n.read_at) return "already_read";
  return null;
}

export function summarize(results: readonly DeviceResult[]): Summary {
  const s: Summary = { sent: 0, failed: 0, skipped: 0, deactivated: 0 };
  for (const r of results) s[r.status] += 1;
  return s;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Short, non-reversible token hint for logs. */
export function tokenHint(token: string): string {
  return token.length <= 8 ? "***" : `${token.slice(0, 4)}…${token.slice(-4)}`;
}

/**
 * Message of an error followed by its `cause` chain ("fetch failed <- error
 * sending request for url (...)"), so a failed delivery can be diagnosed from
 * the log. Non-errors are stringified; cycles and deep chains are cut off.
 */
export function describeError(e: unknown, maxDepth = 4): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = e;
  while (cur !== undefined && cur !== null && parts.length < maxDepth && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      parts.push(cur.message || cur.name);
      cur = cur.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" <- ") || "unknown error";
}

/**
 * Replace every occurrence of a device token (raw or URL-encoded, as it
 * appears in the APNs request URL that fetch errors quote) with its short
 * hint, so neither the log line nor the response stored by pg_net carries it.
 */
export function redactToken(text: string, token: string): string {
  if (!token) return text;
  let out = text;
  for (const needle of new Set([token, encodeURIComponent(token)])) {
    if (needle) out = out.split(needle).join(tokenHint(token));
  }
  return out;
}
