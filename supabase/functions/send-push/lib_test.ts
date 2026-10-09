import { assert, assertEquals, assertFalse, assertThrows } from "jsr:@std/assert@1";
import {
  apnsDeviceUrl,
  apnsHeaders,
  apnsReason,
  base64Decode,
  base64UrlDecode,
  base64UrlEncode,
  buildApnsPayload,
  buildFcmMessage,
  buildJwt,
  fcmSendUrl,
  isApnsDeadToken,
  isFcmDeadToken,
  isUuid,
  type NotificationRow,
  parseApnsEnv,
  parseFcmError,
  parseServiceAccount,
  pemToDer,
  pushSkipReason,
  summarize,
  tokenHint,
  utf8,
} from "./lib.ts";

const NOTIFICATION: NotificationRow = {
  id: "0f1e2d3c-4b5a-4968-8776-655443322110",
  recipient_profile_id: "11111111-2222-4333-8444-555555555555",
  type: "new_message",
  title: "Alex sent you a message",
  body: "See you at training",
  entity_type: "conversation",
  entity_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  read_at: null,
};

// ---------------------------------------------------------------------------
// base64 / base64url

Deno.test("base64UrlEncode produces unpadded url-safe output", () => {
  // 0xfb 0xff 0xbf -> standard "+/+/" ; url-safe "-_-_"
  assertEquals(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xbf])), "-_-_");
  assertEquals(base64UrlEncode("a"), "YQ"); // "YQ==" without padding
  assertEquals(base64UrlEncode(""), "");
  assertEquals(base64UrlEncode(new Uint8Array([1, 2, 3]).buffer), "AQID");
});

Deno.test("base64UrlDecode round-trips with and without padding", () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assertEquals(base64UrlDecode(base64UrlEncode(bytes)), bytes);
  assertEquals(base64UrlDecode("YQ"), utf8("a"));
  assertEquals(base64UrlDecode("YQ=="), utf8("a"));
});

Deno.test("base64Decode ignores whitespace and missing padding", () => {
  assertEquals(new TextDecoder().decode(base64Decode("aGVs\nbG8g d29y\r\nbGQ")), "hello world");
});

// ---------------------------------------------------------------------------
// PEM

Deno.test("pemToDer strips the envelope and decodes the body", () => {
  const der = new Uint8Array([0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0xff]);
  const b64 = btoa(String.fromCharCode(...der));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
  assertEquals(pemToDer(pem), der);
});

Deno.test("pemToDer accepts escaped newlines, CRLF and other labels", () => {
  const der = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const b64 = btoa(String.fromCharCode(...der));
  assertEquals(pemToDer(`-----BEGIN PRIVATE KEY-----\\n${b64}\\n-----END PRIVATE KEY-----`), der);
  assertEquals(pemToDer(`-----BEGIN EC PRIVATE KEY-----\r\n${b64}\r\n-----END EC PRIVATE KEY-----\r\n`), der);
  assertEquals(pemToDer(b64), der); // bare base64 also works
});

Deno.test("pemToDer rejects empty input", () => {
  assertThrows(() => pemToDer("-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----"));
});

// ---------------------------------------------------------------------------
// JWT

Deno.test("buildJwt signs header.payload and appends base64url signature", async () => {
  let signed: Uint8Array | null = null;
  const jwt = await buildJwt({ alg: "ES256", kid: "ABC123" }, { iss: "TEAM", iat: 1700000000 }, (data) => {
    signed = data;
    return Promise.resolve(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });
  const [h, p, s] = jwt.split(".");
  assertEquals(JSON.parse(new TextDecoder().decode(base64UrlDecode(h))), { alg: "ES256", kid: "ABC123" });
  assertEquals(JSON.parse(new TextDecoder().decode(base64UrlDecode(p))), { iss: "TEAM", iat: 1700000000 });
  assertEquals(s, "3q2-7w");
  assertEquals(new TextDecoder().decode(signed!), `${h}.${p}`);
});

Deno.test("buildJwt + WebCrypto ES256 produces a verifiable token", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwt = await buildJwt(
    { alg: "ES256", kid: "K" },
    { iss: "T", iat: 1 },
    async (d) => new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, d)),
  );
  const [h, p, s] = jwt.split(".");
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pair.publicKey,
    base64UrlDecode(s),
    utf8(`${h}.${p}`),
  );
  assert(ok);
});

// ---------------------------------------------------------------------------
// Payloads

Deno.test("buildApnsPayload shape", () => {
  const p = buildApnsPayload(NOTIFICATION);
  assertEquals(p, {
    aps: { alert: { title: "Alex sent you a message", body: "See you at training" }, sound: "default" },
    notification_id: NOTIFICATION.id,
    entity_type: "conversation",
    entity_id: NOTIFICATION.entity_id!,
  });
  assertEquals(typeof p.notification_id, "string");
});

Deno.test("buildApnsPayload omits null body and entity fields", () => {
  const p = buildApnsPayload({ ...NOTIFICATION, body: null, entity_type: null, entity_id: null });
  assertEquals(p, {
    aps: { alert: { title: NOTIFICATION.title }, sound: "default" },
    notification_id: NOTIFICATION.id,
  });
  assertFalse("entity_type" in p);
  assertFalse("body" in p.aps.alert);
});

Deno.test("buildFcmMessage shape: data values are strings, android high priority", () => {
  const m = buildFcmMessage("tok-123", NOTIFICATION);
  assertEquals(m, {
    token: "tok-123",
    notification: { title: NOTIFICATION.title, body: "See you at training" },
    data: { notification_id: NOTIFICATION.id, entity_type: "conversation", entity_id: NOTIFICATION.entity_id! },
    android: { priority: "high" },
  });
  for (const v of Object.values(m.data)) assertEquals(typeof v, "string");
  assertEquals(typeof m.data.notification_id, "string");
});

Deno.test("buildFcmMessage omits null fields instead of sending 'null'", () => {
  const m = buildFcmMessage("tok", { ...NOTIFICATION, body: null, entity_type: null, entity_id: null });
  assertEquals(m.data, { notification_id: NOTIFICATION.id });
  assertEquals(m.notification, { title: NOTIFICATION.title });
});

// ---------------------------------------------------------------------------
// Endpoints / headers

Deno.test("APNs environment and URLs", () => {
  assertEquals(parseApnsEnv(undefined), "production");
  assertEquals(parseApnsEnv("production"), "production");
  assertEquals(parseApnsEnv("Sandbox"), "sandbox");
  assertEquals(parseApnsEnv("development"), "sandbox");
  assertEquals(apnsDeviceUrl("production", "abc"), "https://api.push.apple.com/3/device/abc");
  assertEquals(apnsDeviceUrl("sandbox", "abc"), "https://api.sandbox.push.apple.com/3/device/abc");
  assertEquals(fcmSendUrl("my-proj"), "https://fcm.googleapis.com/v1/projects/my-proj/messages:send");
});

Deno.test("apnsHeaders carries bearer jwt, topic, alert push type", () => {
  const h = apnsHeaders("JWT", "uk.co.ballfindr.app", NOTIFICATION.id);
  assertEquals(h.authorization, "bearer JWT");
  assertEquals(h["apns-topic"], "uk.co.ballfindr.app");
  assertEquals(h["apns-push-type"], "alert");
  assertEquals(h["apns-priority"], "10");
  assertEquals(h["apns-collapse-id"], NOTIFICATION.id);
  assertFalse("apns-collapse-id" in apnsHeaders("JWT", "t"));
});

// ---------------------------------------------------------------------------
// Service account

Deno.test("parseServiceAccount accepts raw JSON and base64 JSON", () => {
  const sa = {
    project_id: "p",
    client_email: "e@x.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n",
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const raw = JSON.stringify(sa);
  assertEquals(parseServiceAccount(raw), sa);
  assertEquals(parseServiceAccount(btoa(raw)), sa);
  assertThrows(() => parseServiceAccount(JSON.stringify({ project_id: "p" })));
});

// ---------------------------------------------------------------------------
// Dead-token decisions

Deno.test("isApnsDeadToken: 410 and documented reasons", () => {
  assert(isApnsDeadToken(410, "Unregistered"));
  assert(isApnsDeadToken(410, undefined));
  assert(isApnsDeadToken(400, "BadDeviceToken"));
  assert(isApnsDeadToken(400, "DeviceTokenNotForTopic"));
  assert(isApnsDeadToken(400, "Unregistered"));
  assertFalse(isApnsDeadToken(400, "BadTopic"));
  assertFalse(isApnsDeadToken(403, "ExpiredProviderToken"));
  assertFalse(isApnsDeadToken(429, "TooManyRequests"));
  assertFalse(isApnsDeadToken(500, undefined));
});

Deno.test("apnsReason parses JSON bodies and tolerates garbage", () => {
  assertEquals(apnsReason('{"reason":"BadDeviceToken"}'), "BadDeviceToken");
  assertEquals(apnsReason({ reason: "Unregistered", timestamp: 1 }), "Unregistered");
  assertEquals(apnsReason("not json"), undefined);
  assertEquals(apnsReason(""), undefined);
});

Deno.test("isFcmDeadToken: 404 UNREGISTERED", () => {
  const body = {
    error: {
      code: 404,
      message: "Requested entity was not found.",
      status: "NOT_FOUND",
      details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }],
    },
  };
  assert(isFcmDeadToken(404, parseFcmError(JSON.stringify(body))));
  assert(isFcmDeadToken(404, parseFcmError({ error: { status: "UNREGISTERED" } })));
});

Deno.test("isFcmDeadToken: 400 INVALID_ARGUMENT naming the token", () => {
  const byMessage = {
    error: {
      code: 400,
      message: "The registration token is not a valid FCM registration token",
      status: "INVALID_ARGUMENT",
      details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "INVALID_ARGUMENT" }],
    },
  };
  assert(isFcmDeadToken(400, parseFcmError(byMessage)));

  const byField = {
    error: {
      code: 400,
      message: "Request contains an invalid argument.",
      status: "INVALID_ARGUMENT",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.BadRequest",
          fieldViolations: [{ field: "message.token", description: "Invalid registration token" }],
        },
      ],
    },
  };
  assert(isFcmDeadToken(400, parseFcmError(byField)));
});

Deno.test("isFcmDeadToken: 400 about another field is a payload bug, not a dead token", () => {
  const body = {
    error: {
      code: 400,
      message: "Invalid value at 'message.data[0].value'",
      status: "INVALID_ARGUMENT",
      details: [{
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        fieldViolations: [{ field: "message.data[0].value", description: "must be a string" }],
      }],
    },
  };
  assertFalse(isFcmDeadToken(400, parseFcmError(body)));
  assertFalse(isFcmDeadToken(401, parseFcmError({ error: { status: "UNAUTHENTICATED" } })));
  assertFalse(
    isFcmDeadToken(
      429,
      parseFcmError({ error: { status: "RESOURCE_EXHAUSTED", details: [{ errorCode: "QUOTA_EXCEEDED" }] } }),
    ),
  );
  assertFalse(isFcmDeadToken(503, parseFcmError("<html>bad gateway</html>")));
});

Deno.test("parseFcmError extracts status, errorCode, message, fields", () => {
  const info = parseFcmError({
    error: {
      message: "m",
      status: "INVALID_ARGUMENT",
      details: [
        { errorCode: "INVALID_ARGUMENT" },
        { fieldViolations: [{ field: "message.token" }, { field: "message.android" }] },
      ],
    },
  });
  assertEquals(info, {
    status: "INVALID_ARGUMENT",
    errorCode: "INVALID_ARGUMENT",
    message: "m",
    fields: ["message.token", "message.android"],
  });
  assertEquals(parseFcmError("plain text").fields, []);
  assertEquals(parseFcmError(null).fields, []);
});

// ---------------------------------------------------------------------------
// Gating and summary

Deno.test("pushSkipReason honours push_enabled and read_at; no row = on", () => {
  assertEquals(pushSkipReason(NOTIFICATION, null), null);
  assertEquals(pushSkipReason(NOTIFICATION, { push_enabled: true }), null);
  assertEquals(pushSkipReason(NOTIFICATION, { push_enabled: false }), "push_disabled");
  assertEquals(pushSkipReason({ read_at: "2026-10-09T00:00:00Z" }, null), "already_read");
  assertEquals(pushSkipReason({ read_at: "2026-10-09T00:00:00Z" }, { push_enabled: false }), "push_disabled");
});

Deno.test("summarize counts each status", () => {
  assertEquals(
    summarize([
      { device_id: "1", platform: "ios", status: "sent" },
      { device_id: "2", platform: "ios", status: "sent" },
      { device_id: "3", platform: "android", status: "failed" },
      { device_id: "4", platform: "android", status: "skipped" },
      { device_id: "5", platform: "ios", status: "deactivated" },
    ]),
    { sent: 2, failed: 1, skipped: 1, deactivated: 1 },
  );
  assertEquals(summarize([]), { sent: 0, failed: 0, skipped: 0, deactivated: 0 });
});

Deno.test("isUuid and tokenHint", () => {
  assert(isUuid(NOTIFICATION.id));
  assert(isUuid(NOTIFICATION.id.toUpperCase()));
  assertFalse(isUuid("not-a-uuid"));
  assertFalse(isUuid(123));
  assertFalse(isUuid(null));
  assertEquals(tokenHint("abcdefghijklmnop"), "abcd…mnop");
  assertEquals(tokenHint("short"), "***");
});
