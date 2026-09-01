# Anmelden über MedArbeiter — Integrationsanleitung für Hausanwendungen

You are integrating a **client app** against the MedArbeiter Hub, which acts as the
OAuth 2.0 **authorization server** for all in-house apps. Your app does not store
passwords and does not build a user table with credentials — it sends the user to
MedArbeiter, gets their identity back, and runs its **own session** from there.

Read this whole file before writing code. The protocol is deliberately small:
plain OAuth 2.0 authorization-code flow with **opaque tokens** — **no OIDC, no
JWT, no discovery document, no refresh tokens**. Do not pull in an OIDC library
that expects `/.well-known/openid-configuration`; a generic OAuth2 client or
~100 lines of hand-written code is the right size.

## What you get from the MedArbeiter side (ask the Verwaltung)

Your app must be registered in MedArbeiter under **/apps** („Verbundene Apps").
Registration produces:

| Item | Notes |
|---|---|
| `CLIENT_ID` | UUID, public — fine in configs and URLs. |
| `CLIENT_SECRET` | Shown **exactly once** at registration. Server-side env var only; it must never reach a browser bundle, a log line, or the repo. If it is lost, it cannot be read back — it is *renewed* in MedArbeiter (the old one dies instantly). |
| Registered redirect URI(s) | You provide these at registration. Matching is **exact string** — no trailing-slash tolerance, no wildcards, no extra query params. `https://` required, plain `http://` only for `localhost`/`127.0.0.1`. |
| `MEDARBEITER_URL` | Base URL of the hub (production: `https://hub.med-arbeiter.de`; local dev: e.g. `http://localhost:3001`). |

Changing your callback path later means updating the registration in MedArbeiter
first — an unregistered `redirect_uri` is rejected with a 400 page, never redirected.

## The flow (three requests)

### 1. Send the browser to the authorize endpoint

```
302 →  {MEDARBEITER_URL}/api/oauth/authorize
         ?client_id={CLIENT_ID}
         &redirect_uri={REDIRECT_URI}     (URL-encoded, exactly as registered)
         &response_type=code
         &state={RANDOM_STATE}
```

- `state` is **required** — the server redirects back with `error=invalid_request`
  without it. Generate a random value per attempt, bind it to the browser
  (e.g. short-lived httpOnly cookie), and verify it on the callback. This is your
  CSRF protection; treat a state mismatch as a hard failure.
- The flow is **never silent**: if the user has no live MedArbeiter session
  (30-day cookie) they see MedArbeiter's login first, and every round-trip ends
  on a **confirm screen** ("Anmeldung freigeben") naming your app and what it
  will learn. Only their click issues the code; "Abbrechen" returns
  `error=access_denied` to your callback.

### 2. Handle the callback

Success: `GET {REDIRECT_URI}?code=…&state=…` — verify `state`, then exchange the
code immediately (it lives **60 seconds** and is **single-use**).

Failure: `GET {REDIRECT_URI}?error=…&state=…` with `error` ∈
`unsupported_response_type` | `invalid_request` | `access_denied` (the user
pressed "Abbrechen" on the confirm screen). Show a German error page and
offer to retry.

### 3. Exchange the code — server to server

```
POST {MEDARBEITER_URL}/api/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(urlencode(CLIENT_ID) + ":" + urlencode(CLIENT_SECRET))

grant_type=authorization_code&code={CODE}&redirect_uri={REDIRECT_URI}
```

- Client auth: HTTP Basic (shown above) **or** `client_id`/`client_secret` as
  additional form fields — both work; Basic is preferred.
- `redirect_uri` must be the same value as in step 1.
- Success `200`: `{"access_token":"…","token_type":"Bearer","expires_in":3600}`
- Errors: `401 {"error":"invalid_client"}` (wrong/unknown credentials — this is
  also written to MedArbeiter's audit log), `400 {"error":"invalid_grant"}`
  (expired, wrong URI, or already-used code), `400 invalid_request` /
  `unsupported_grant_type`.
- **Never retry this request with the same code.** A second redemption not only
  fails — it revokes the token from the first redemption (RFC 6749 replay
  protection). Make your callback handler idempotent against double-submits
  (browser refresh on the callback URL) by consuming the code exactly once.

### 4. Read the identity

```
GET {MEDARBEITER_URL}/api/oauth/userinfo
Authorization: Bearer {ACCESS_TOKEN}
```

Success `200`:

```json
{
  "sub": "17",
  "name": "Max Muster",
  "email": "max@firma.de",
  "role": "mitarbeiter",
  "rechte": ["zeit.erfassen", "abwesenheit.beantragen", "…"]
}
```

Failure `401 {"error":"invalid_token"}` — token expired, revoked, or the account
was deactivated in MedArbeiter. Restart the flow from step 1.

`rechte[]` is always the **fully expanded** concrete list. An account can hold
the all-rights shorthand `*` inside MedArbeiter, but that placeholder never
appears in the payload — it is expanded server-side into every registered
recht at response time, so a plain `rechte.includes("some.right")` check is
always correct and always complete.

## Optional: the roles/rechte catalog

```
GET {MEDARBEITER_URL}/api/oauth/roles
Authorization: Basic base64(urlencode(CLIENT_ID) + ":" + urlencode(CLIENT_SECRET))
```

Same credential pair and validation as the token endpoint — no user token
needed. Use it to learn which roles and rechte exist (e.g. to render
permission-dependent UI or validate config) instead of hardcoding the lists.

Success `200`:

```json
{
  "roles": ["mitarbeiter", "fulfillment", "vertrieb", "verwaltung", "geschaeftsfuehrung"],
  "rechte": ["zeit.erfassen", "…", "ai.subaccounts.read", "ai.subaccounts.manage", "ai.settings.manage"]
}
```

Both arrays are plain strings: every defined role and every registered
concrete recht. `*` is never included (see above). Failure
`401 {"error":"invalid_client"}` — wrong/unknown credentials, also written to
MedArbeiter's audit log. Cache the response in-process; roles and rechte
change rarely (a new recht ships with a hub deployment, a new role is created
in the Rollenverwaltung).

## How to use what you got

- **`sub` is the identity key.** A stable string ID — store your users keyed on
  `sub`, never on `email` (emails can change; `sub` cannot). Upsert
  name/email/role/rechte from the payload on every login.
- **Create your own session immediately** and forget the access token. It lives
  1 hour, there are no refresh tokens, and it exists only to carry this one
  userinfo call. Do not use it as your session, do not store it, do not log it.
- **Re-authentication is just the redirect again.** While the user's MedArbeiter
  cookie lives, a fresh authorize round-trip skips the login and costs exactly
  one click on the confirm screen — so size your app's session lifetime for
  convenience, not for avoiding re-auth.
- **`role` and `rechte` are a snapshot at login.** Roles are editable records
  in MedArbeiter (the five shipped ones are `mitarbeiter` | `fulfillment` |
  `vertrieb` | `verwaltung` | `geschaeftsfuehrung`; the catalog endpoint below
  returns the current list). Treat
  `rechte[]` as the authoritative permission set (accounts can carry extra
  rights beyond their role bundle — never derive permissions from `role`
  yourself). They refresh on the next login; a deactivated account cannot log
  in again anywhere, but your app's already-issued session survives until it
  expires — size your session lifetime accordingly (a working day is a
  reasonable ceiling), or re-run the authorize round-trip to re-check.

## Reference implementation sketch (TypeScript, framework-agnostic)

```ts
// GET /anmelden — start
const state = crypto.randomUUID();
setCookie('oauth_state', state, {httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/'});
redirect(`${HUB}/api/oauth/authorize?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${state}`);

// GET /anmelden/rueckkehr — callback
if (query.error || !query.code || query.state !== getCookie('oauth_state')) return fehlerSeite();
deleteCookie('oauth_state');
const tokenRes = await fetch(`${HUB}/api/oauth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic ' + btoa(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`),
  },
  body: new URLSearchParams({grant_type: 'authorization_code', code: query.code, redirect_uri: REDIRECT_URI}),
});
if (!tokenRes.ok) return fehlerSeite();
const {access_token} = await tokenRes.json();
const infoRes = await fetch(`${HUB}/api/oauth/userinfo`, {headers: {Authorization: `Bearer ${access_token}`}});
if (!infoRes.ok) return fehlerSeite();
const person = await infoRes.json();          // {sub, name, email, role, rechte}
upsertBenutzer(person);                        // keyed on person.sub
await eigeneSessionAnlegen(person.sub);        // your app's own session cookie
redirect('/');
```

## Checklist before you call it done

- [ ] `CLIENT_SECRET` lives in a server-side env var; grep confirms it appears in no client bundle and no log statement.
- [ ] `state` is generated per attempt, carried in an httpOnly cookie, verified and then discarded on the callback.
- [ ] The callback consumes each `code` exactly once; a refresh of the callback URL does not re-POST to the token endpoint.
- [ ] The registered redirect URI and the one in your code are byte-identical.
- [ ] Users are keyed on `sub`; name/email/role/rechte are upserted on every login.
- [ ] The access token is used for one userinfo call and then dropped.
- [ ] A failed flow shows a German error page with a retry, not a stack trace.
- [ ] Log lines around the flow contain no code, no token, no secret.
