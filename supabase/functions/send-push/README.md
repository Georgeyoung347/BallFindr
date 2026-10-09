# send-push

Supabase Edge Function that turns a row in `public.notifications` into a native push on every active device of the
recipient: APNs (HTTP/2, provider token auth) for iOS and FCM HTTP v1 (OAuth2 service account) for Android.

It is the server-side half of the "one notification system" rule in `AGENTS.md`: the website creates notifications
exactly as before, the database trigger calls this function, and this function reads `public.push_devices`.

## How the trigger reaches it

Migration `20261008111045_*.sql`:

1. `vault.secrets` holds `push_hook_secret` (random, generated once).
2. `AFTER INSERT ON public.notifications` runs `notifications_after_insert_push()`, which uses `pg_net` to
   `POST https://<project>.supabase.co/functions/v1/send-push` with `{"notification_id": "<uuid>"}` and header
   `x-push-hook-secret: <secret>`. Errors are swallowed so an outage can never break in-app notifications.
3. The request carries **no Authorization JWT**, so `supabase/config.toml` declares
   `[functions.send-push] verify_jwt = false`, and the function checks the secret itself with
   `public.push_hook_secret_ok(_s)` (service-role only). Anything else gets `401`.

Preference gating: the category switches (`messages`, `applications`, `trials`, `recruitment`) are enforced **before**
the row is inserted (`private.notification_before_insert`), so a notification that reaches this function already passed
them. The only preference checked here is the master switch `notification_preferences.push_enabled` (no row = on). A
notification that is already `read_at` when the function runs is also skipped (keeps retries quiet).

## Required secrets

Set with `supabase secrets set` (see below). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

| Secret                     | Required for   | Notes                                                                                          |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `APNS_TEAM_ID`             | iOS            | Apple Developer Team ID (10 chars).                                                            |
| `APNS_KEY_ID`              | iOS            | Key ID of the APNs Auth Key (`.p8`).                                                           |
| `APNS_PRIVATE_KEY`         | iOS            | Contents of the `.p8` file (PEM). Literal `\n` sequences are accepted.                         |
| `APNS_BUNDLE_ID`           | iOS (optional) | `apns-topic`. Defaults to `uk.co.ballfindr.app`.                                               |
| `APNS_ENV`                 | iOS (optional) | `production` (default) or `sandbox` (Xcode/debug builds).                                      |
| `FCM_SERVICE_ACCOUNT_JSON` | Android        | Firebase service account JSON (raw or base64). Needs the Firebase Cloud Messaging API enabled. |

If a platform's secrets are missing, devices on that platform are reported as `skipped` with `apns_not_configured` /
`fcm_not_configured` and the response lists the platform under `not_configured`. Nothing crashes.

```sh
supabase secrets set APNS_TEAM_ID=ABCDE12345 APNS_KEY_ID=XYZ987WXYZ APNS_ENV=production
supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XYZ987WXYZ.p8)"
supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat ballfindr-firebase-adminsdk.json)"
# or, if your shell mangles the JSON:
supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(base64 -w0 ballfindr-firebase-adminsdk.json)"
```

## Deploy

```sh
supabase link --project-ref rnkybpumgsihkwfwexsv   # once
supabase functions deploy send-push
```

`verify_jwt = false` comes from `supabase/config.toml`; you can also pass `--no-verify-jwt` explicitly. The function
reads secrets at isolate start, so re-deploy (or wait for a cold start) after changing them.

## Response

```json
{
  "notification_id": "…",
  "sent": 1,
  "failed": 0,
  "skipped": 1,
  "deactivated": 0,
  "not_configured": ["android"],
  "devices": [
    { "device_id": "…", "platform": "ios", "status": "sent", "http_status": 200 },
    { "device_id": "…", "platform": "android", "status": "skipped", "reason": "fcm_not_configured" }
  ]
}
```

- `sent`: the provider accepted the push (`last_seen_at` is bumped on the device row).
- `deactivated`: the provider said the token is dead (`is_active = false`, `updated_at = now()`): APNs `410` or reasons
  `BadDeviceToken`, `Unregistered`, `DeviceTokenNotForTopic`; FCM `404 UNREGISTERED`, or `400 INVALID_ARGUMENT` that
  names the token.
- `failed`: anything else (transient provider errors, bad credentials). Logged with `console.error`. For a network error
  the `reason` carries the error and its cause chain (for example
  `fetch failed <- error sending request for url (https://api.push.apple.com/3/device/0123…cdef): ...`) with the device
  token already redacted.
- `skipped`: platform not configured.
- Early exits use `reason`: `push_disabled`, `already_read`, `no_active_devices`.

Tokens are never returned or logged in full.

## Test locally

```sh
cd supabase/functions/send-push
deno task check        # type-check
deno task test         # unit tests for lib.ts (no network needed)
```

From the repo root the same thing is `bunx deno check --no-lock supabase/functions/send-push/index.ts` and
`bunx deno test --no-lock supabase/functions/send-push/`. Deno looks for its config in the current directory, so from
the root it sees the website's `package.json` instead of this folder's `deno.json` and, without `--no-lock`, writes a
stray `deno.lock` at the repo root (delete it if that happens; it must not be committed). CI
(`.github/workflows/mobile.yml`) runs the `deno task` commands inside this folder.

Serve it locally (needs the local stack and an env file with the secrets; use `.env.local`, which the repo's
`.gitignore` already excludes through `*.local`, so real keys never end up in a commit):

```sh
supabase start
supabase functions serve send-push --no-verify-jwt --env-file supabase/functions/.env.local
```

Then, with the local hook secret
(`select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret';` through `supabase db` / Studio)
and an existing notification id:

```sh
curl -sS -X POST http://127.0.0.1:54321/functions/v1/send-push \
  -H 'content-type: application/json' \
  -H "x-push-hook-secret: $PUSH_HOOK_SECRET" \
  -d '{"notification_id":"00000000-0000-4000-8000-000000000000"}'
```

Against the deployed function:

```sh
curl -sS -X POST https://rnkybpumgsihkwfwexsv.supabase.co/functions/v1/send-push \
  -H 'content-type: application/json' \
  -H "x-push-hook-secret: $PUSH_HOOK_SECRET" \
  -d '{"notification_id":"<uuid of a row in public.notifications>"}'
```

Expected responses: `401` with a wrong/missing secret, `400` for a non-uuid `notification_id`, `404` for an unknown
notification, `405` for non-POST, otherwise `200` with the JSON above. The simplest end-to-end check is to insert a
notification for an account that has a registered device (e.g. send that account a message) and watch the function logs
in the Supabase dashboard.

## Operational notes

- The APNs provider JWT is cached for 50 minutes per isolate; an `ExpiredProviderToken` / `InvalidProviderToken` answer
  refreshes it and retries once.
- `APNS_ENV` must match the build that registered the token: APNs answers `BadDeviceToken` when a sandbox (Xcode debug)
  token is sent to production or vice versa, and that reason **deactivates** the device row. Keep `APNS_ENV=production`
  for App Store / TestFlight builds and only switch to `sandbox` against a project whose devices all run debug builds.
- The FCM OAuth2 access token is cached until a minute before it expires; a `401` from FCM clears the cache for the next
  call.
- Devices are sent to in parallel (`Promise.allSettled`); one device failing never affects another.
- `apns-collapse-id` is the notification id, so a redelivered call replaces rather than duplicates the banner on iOS.
- The function is safe to call repeatedly for the same notification: once the row is read in-app it stops sending.
