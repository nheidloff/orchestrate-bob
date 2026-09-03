# Connection kinds — the complete, corrected catalogue

Verified against **ADK 2.15.0**. 

---

## The real list of kinds

From `ConnectionKind` in `ibm_watsonx_orchestrate_core/types/connections/configuration.py`,
which is exactly what `orchestrate connections configure --kind` accepts:

```
basic
bearer
api_key
oauth_auth_code_flow
oauth_auth_password_flow
oauth_auth_client_credentials_flow
oauth_auth_on_behalf_of_flow
key_value  (alias: kv)
```

`oauth_auth_implicit_flow` **does not exist.** 

---

## 1. `basic`

`Authorization: Basic <base64>`. Fields: `username`, `password` (secure), `server_url`.

**Use when** the downstream system supports only HTTP Basic and cannot be migrated —
legacy internal REST APIs, self-hosted services, on-prem middleware.

**Avoid when** anything better exists. Basic credentials never expire on their own;
unrotated service passwords across many connections are a real attack surface.

**Scope:** `member` when the system has per-user accounts with distinct rights; `team`
only for a genuine shared service account — and then use a *dedicated* service account,
never a person's password.

Python ✅ · Remote MCP ✅ · Local MCP ❌ · all surfaces · Developer Edition ✅ 

```yaml
spec_version: v1
kind: connection
app_id: my_app
environments:
  draft: { kind: basic, type: member, server_url: https://example.com/ }
  live:  { kind: basic, type: member, server_url: https://example.com/ }
```

---

## 2. `bearer`

A static pre-issued token in `Authorization: Bearer`. Fields: `token`, `server_url`.

**Use when** the service issues long-lived service tokens or PATs and policy accepts them.

**Risk:** no built-in expiry. If leaked it stays valid until explicitly revoked. If policy
mandates 90-day rotation, you need a process to update the credential — nothing reminds you.

**Scope:** `team` is the common and correct case — a bearer token usually represents an
application, not a person. `member` bearer tokens are fragile: when a user leaves, their
PAT is revoked and the agent breaks for them silently.

Python ✅ · Remote MCP ✅ · Local MCP ❌ · all surfaces · Developer Edition ✅ 

---

## 3. `api_key`

A single key, typically in a custom header. Fields: `api_key`, `server_url`.

**Use when** the downstream is a modern SaaS API keyed this way.

**Advantage over basic/bearer:** designed to be rotated and scoped narrowly — many
providers issue read-only or rate-limited keys.

**Scope:** `team` for a platform subscription key. `member` only where the provider issues
genuinely per-user keys with per-user quotas — rare, and it means every new user must
obtain and register a key before the agent works for them.

⚠ **Custom header name is broken on SaaS at 2.15.0.** `connections configure --name
"X-Auth-Token"` is accepted, but create stores nothing and update returns
`500 … column "name" of relation "application_connection_configs" does not exist`.
Use `key_value` and set the header in tool code instead. **[live — base skill §5]**

Python ✅ · Remote MCP ✅ · Local MCP ❌ · all surfaces · Developer Edition ✅ 

---

## 4. `oauth_auth_code_flow` ✅ per-user, native UI only

Standard OAuth 2.0 authorization code. The user consents at the IDP; Orchestrate exchanges
the code for a short-lived token and refreshes it. Fields: `client_id`, `client_secret`,
`authorization_url`, `token_url`, scopes.

**Why it is the right per-user choice** *on the native UI*: unlike `basic`/`member` (user
types a password into chat) or password flow (password transits Orchestrate), the user's
password is never exposed to Orchestrate at all.

⚠ **Surface constraint: native UI only.** It does not work over the REST API or embedded
web chat — there is no browser context to complete the redirect.  If your
production users are not in the native UI, this flow is a developer convenience.

**Scope:** `member` is the point of it. `team` works but discards the per-user identity
and audit trail you chose OAuth for.

Python ✅ · Remote MCP ✅ · Local MCP ❌ · Developer Edition ⚠ config only (no browser-reachable
redirect at `localhost`) 

---

## 5. `oauth_auth_password_flow` ⚠ last resort

Username and password go to Orchestrate, which exchanges them for a token.

**Why it is problematic:** it breaks OAuth's core premise — the application never sees the
password. Removed in OAuth 2.1 and routinely flagged in security audits. With `member`
scope users type passwords into a chat window, which trains exactly the habit phishing
exploits.

**Use only when** the service exposes nothing but a token endpoint, and client-credentials
is impossible because a *user* identity is required. Narrow and legacy.

**Scope:** `team` with a dedicated service account is the only defensible form.

Python ✅ · Remote MCP ✅ · Local MCP ❌ · native UI only · Developer Edition ✅ 

---

## 6. `oauth_auth_client_credentials_flow` ✅ the M2M default

Orchestrate authenticates as the application. No user involved. Fields: `client_id`,
`client_secret`, `token_url`, optional scopes.

**Use when** the agent calls downstream on the organisation's behalf rather than any
person's — backend integrations, pipelines, AI Gateway, and **every scheduled agent**.

**Why preferred over bearer/basic:** tokens are short-lived and refreshed automatically;
the only long-term secret is the client secret, held by Orchestrate and never sent
downstream.

**Surface:** because the exchange is server-side with no user interaction, `team` scope
works from **any** surface. The native-UI restriction applies only to `member` scope,
which is unusual here. 

**Scope:** `team` — this flow has no concept of user identity.

Python ✅ · Remote MCP ✅ · Local MCP ❌ · Developer Edition ✅ (needs a real IDP)

✅ **Verified against IBM App ID** — `grant_type=client_credentials` returns an
RS256 JWT, `expires_in` 3600, claims `iss/aud/sub/tenant/scope/amr`.

---

## 7. `oauth_auth_on_behalf_of_flow` ✅ the enterprise SSO pattern

Exchanges a user's existing corporate SSO session for a downstream token. No second login.
Fields: `sso: true`, `idp_config`, `app_config`, `server_url`.

**Use when** users reach agents through **embedded web chat** on an SSO-enabled portal and
you must call Workday/SAP/ServiceNow as the actual employee.

⚠ **Surface constraint: embedded web chat only.** Not the native UI. Not the REST API. 

**Why the REST API cannot do it:** the flow depends on a JWT handshake only the web chat
widget implements. Your backend builds a signed JWT whose `user_payload` is encrypted with
IBM's RSA public key; the widget hands it to Orchestrate, which decrypts it, extracts
`sso_token`, and performs the IDP → SAML → downstream exchange. `/v1/orchestrate/runs`
accepts plain context variables and has no equivalent decryption path. 

**The REST-API alternative:** authenticate the user in your app, pass the IDP token as a
context variable, and do the exchange inside a Python tool. Same end result, more code,
works on any surface — and *you* own the trust boundary (SKILL §4.6).

**Scope:** `member` — per-user delegation is the entire purpose.

Python ✅ · Remote MCP ❌ · Local MCP ❌ · Developer Edition ❌ 

⚠ **OBO cannot be used to import remote MCP toolkits** — no authenticated user session
exists at import time. Use `key_value` for the draft import and reserve OBO for live. 

```yaml
environments:
  live:
    kind: oauth_auth_on_behalf_of_flow
    type: member
    sso: true
    server_url: https://example.workday.com/ccx
    idp_config:
      header: { content-type: application/x-www-form-urlencoded }
      body:
        requested_token_use: on_behalf_of
        requested_token_type: urn:ietf:params:oauth:token-type:saml2
    app_config:
      header: { content-type: application/x-www-form-urlencoded }
```

---

## 8. `key_value`

A secure dictionary injected at runtime. Not an auth protocol — a config store, stored
encrypted.

**Use when:** a tool needs several parameters that fit no standard scheme; you must inject
env vars into a **local MCP server** (`key_value` is the *only* kind local MCP supports);
or you are configuring **AI Gateway**, which accepts nothing else. It is also the practical
workaround for a custom API-key header name (see §3).

**Scope:** `team` only — `member` is not supported. Treat the values as application
secrets shared by every user.

Python ✅ · Local MCP ✅ · Remote MCP ❌ · all surfaces · Developer Edition ✅ 

---

## Compatibility tables

### By surface — the decisive one

| Kind | Native UI | REST API | REST API Secure | Embedded web chat | Scheduled |
|---|:---:|:---:|:---:|:---:|:---:|
| `basic` / `bearer` / `api_key` / `key_value` (`team`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `oauth_auth_client_credentials_flow` (`team`) | ✅ | ✅ | ✅ | ✅ | ✅ ⭐ |
| `basic` / `bearer` / `api_key` (`member`) | ✅ | ✅¹ | ✅¹ | ✅¹ | ⛔² |
| `oauth_auth_code_flow` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `oauth_auth_password_flow` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `oauth_auth_on_behalf_of_flow` | ❌ | ❌³ | ✅⁴ | ✅ | ❌ |

¹ admin pre-provisions; no interactive prompt exists.
² the run uses the schedule creator's identity — see SKILL §3.3.
³ not as a *Connection*; the context-variable pattern achieves the same end.
⁴ REST API Secure uses the same RS256 JWT + embed security headers as the widget, which unlocks `oauth_auth_on_behalf_of_flow` connections — see `production-surfaces.md`.

### By tool type

| Kind | Python | Local MCP | Remote MCP |
|---|:---:|:---:|:---:|
| `basic` / `bearer` / `api_key` | ✅ | ❌ | ✅ |
| `oauth_auth_client_credentials_flow` / `_code_flow` / `_password_flow` | ✅ | ❌ | ✅ |
| `oauth_auth_on_behalf_of_flow` | ✅ | ❌ | ❌ |
| `key_value` | ✅ | ✅ | ❌ |

**Use Python for enterprise integrations.** It gives you request construction, retries,
conditional header injection, and multi-system calls in one tool. Flows hold no
credentials — they delegate to the tools they call.

### By environment

| Kind | Developer Edition | SaaS / on-prem |
|---|:---:|:---:|
| `basic` / `bearer` / `api_key` / `key_value` | ✅ | ✅ |
| `oauth_auth_client_credentials_flow` / `_password_flow` | ✅ | ✅ |
| `oauth_auth_code_flow` | ⚠ config only | ✅ |
| `oauth_auth_on_behalf_of_flow` | ❌ | ✅ |

**For demos:** the four static kinds plus client-credentials run fully in Developer
Edition. Auth-code needs SaaS. OBO needs SaaS *and* embedded web chat *and* a real IDP.

### By scope

| Kind | `member` | `team` | Enterprise default |
|---|:---:|:---:|---|
| `basic` | ✅ | ✅ | `member` where per-user accounts exist |
| `bearer` | ✅ | ✅ | `team` — tokens represent the app |
| `api_key` | ✅ | ✅ | `team`; `member` only for per-user quotas |
| `oauth_auth_client_credentials_flow` | ✅ | ✅ | `team` — no user identity in this flow |
| `oauth_auth_code_flow` | ✅ | ✅ | `member` |
| `oauth_auth_password_flow` | ✅ | ✅ | `team` + service account only |
| `oauth_auth_on_behalf_of_flow` | ✅ | ✅ | `member` |
| `key_value` | ❌ | ✅ | `team` (only option) |

### Knowledge bases

| Kind | Milvus | Elasticsearch | Custom search |
|---|:---:|:---:|:---:|
| `basic` | ✅ | ✅ | ✅ |
| `api_key` | ❌ | ✅ | ✅ |
| everything else | ❌ | ❌ | ❌ |

**AI Gateway accepts `key_value` only.**

