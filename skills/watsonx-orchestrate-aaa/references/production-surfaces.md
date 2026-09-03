# watsonx Orchestrate — Production Access Surfaces Compared

Three surfaces for delivering a watsonx Orchestrate agent to end users. Each makes different trade-offs around UI ownership, credential security, stream format, and identity propagation.

---

## Surface Overview

| | REST API | REST API Secure | Embedded web chat |
|---|---|---|---|
| **Chat UI** | Custom (any framework) | Custom (any framework) | IBM widget (`wxoLoader.js`) |
| **Auth credential on server** | API key | RSA-4096 private key | RSA-4096 private key |
| **wxO auth token** | IAM Bearer token | RS256 JWT | RS256 JWT |
| **RSA embed security setup** | Not required | Required | Required |

---

## Architecture

### REST API — Custom UI, IAM Bearer token

```
Browser (custom UI)
  │  POST /chat/stream  (session cookie)
  ▼
Application server
  │  API key → POST https://account-iam.../apikeys/token
  │  IAM Bearer token (cached, ~1h)
  │  POST /v1/orchestrate/runs/stream
  │    Authorization: Bearer <iam-token>
  │    Body: { message, agent_id, context_variables: { roles, email, sso_token } }
  ▼
wxO backend  →  NDJSON stream  →  server translates to SSE  →  browser
```

- User identity (roles, email, sso\_token) travels in the **request body** as `context_variables` — plain JSON, not encrypted.
- The server holds a long-lived API key; it exchanges that for a short-lived IAM token and caches it.
- The server **translates** the raw wxO NDJSON into standard SSE (`event:\ndata:\n\n`) before forwarding to the client.

### REST API Secure — Custom UI, RS256 JWT

```
Browser (custom UI)
  │  POST /chat  (session cookie)
  ▼
Application server
  │  Mints RS256 JWT from session user:
  │    context (plain):       { roles, email, sso_token, clientID }
  │    user_payload (RSA-encrypted for wxO): { name, sub }
  │  POST /v1/orchestrate/runs?stream=true&stream_timeout=60000
  │    Authorization: Bearer <RS256-JWT>
  │    x-ibm-wo-orchestrate-id, x-ibm-wo-user-id, x-watson-channel, [x-ibm-wo-crn]
  ▼
wxO backend  →  NDJSON stream  →  server pipes verbatim  →  browser parses NDJSON directly
```

- No API key anywhere. The private key signs JWTs but cannot call wxO on its own.
- Sensitive identity fields (`name`, `sub`) are **RSA-encrypted** inside `user_payload` — only the wxO backend can decrypt them.
- The server pipes the raw NDJSON stream **verbatim**; the client parses `{id, event, data}` lines directly.

### Embedded web chat — IBM Widget, RS256 JWT

```
Browser
  │  GET /createJWT  (session cookie)
  ▼
Application server
  │  Mints RS256 JWT (same structure as REST API Secure)
  │  Returns JWT as plain text
  ▼
Browser
  │  window.wxOConfiguration = { token, orchestrationID, hostURL, chatOptions, ... }
  │  <script src="hostURL/wxochat/wxoLoader.js?embed=true">
  ▼
IBM wxoLoader widget
  │  Manages all wxO API calls internally
  │  Renders chat UI (bubbles, starter prompts, threading)
  ▼
wxO backend
```

- The JWT structure is identical to REST API Secure (`context` plain, `user_payload` encrypted).
- IBM's widget owns all wxO communication — no custom message loop, no stream parsing.
- The host application has no programmatic access to individual events or tool calls.

---

## API Endpoints Used

| Endpoint | REST API | REST API Secure | Embedded web chat |
|---|---|---|---|
| `POST /v1/orchestrate/runs/stream` | ✅ | — | — |
| `POST /v1/orchestrate/runs?stream=true` | — | ✅ | widget-internal |
| IAM token exchange (`/api/2.0/apikeys/token`) | ✅ | — | — |
| IBM embed key generation (`/v1/ibmsec/generate-key-pair`) | — | setup only | setup only |

**wxO request headers** (REST API Secure and Embedded web chat only):

| Header | Value |
|---|---|
| `Authorization` | `Bearer <RS256-JWT>` |
| `x-ibm-wo-orchestrate-id` | Tenant orchestration ID |
| `x-ibm-wo-user-id` | Stable UUID (per server process) |
| `x-watson-channel` | `agentic_chat` |
| `x-ibm-wo-crn` | IBM Cloud CRN (omitted if not set) |

---

## Data Formats

### Stream format received by the client

**REST API — Standard SSE** (server-translated):
```
event: message.delta
data: {"thread_id":"...","delta":{"content":[{"text":"Hello"}]}}

event: final.text
data: {"text":"Hello, how can I help?"}

event: tool.calls
data: {"steps":[{"type":"call","name":"search_flights","input":"..."}]}

event: thread_id
data: {"thread_id":"abc-123"}
```
The server parses the NDJSON from wxO and emits these synthetic events. `final.text`, `tool.calls`, and `thread_id` do not exist in the wxO protocol — they are added by the server.

**REST API Secure — Raw NDJSON** (verbatim from wxO):
```json
{"id":"evt-1","event":"run.started","data":{"thread_id":"abc","run_id":"xyz"}}
{"id":"evt-3","event":"message.delta","data":{"thread_id":"abc","delta":{"content":[{"response_type":"text","text":"Hello"}]}}}
{"id":"evt-6","event":"run.step.delta","data":{"delta":{"step_details":[{"type":"tool_calls","tool_calls":[{"name":"search_flights","args":{}}]}]}}}
{"id":"evt-9","event":"message.created","data":{"message":{"content":[{"response_type":"text","text":"Hello, how can I help?"}]}}}
{"id":"evt-11","event":"run.completed","data":{"thread_id":"abc","run_id":"xyz"}}
{"id":"evt-12","event":"done","data":{"thread_id":"abc","run_id":"xyz"}}
```
The client accumulates `message.delta` chunks, captures `thread_id` from any event's `data.thread_id`, and extracts tool calls from `run.step.delta`. No synthetic events.

### JWT structure (REST API Secure and Embedded web chat)

```json
{
  "sub": "<app-id-user-uuid>",
  "context": {
    "clientID":  "my-app",
    "email":     "user@example.com",
    "sso_token": "<app-id-access-token>",
    "roles":     ["trip_booker"]
  },
  "user_payload": "<RSA-PKCS1v1.5-base64-encrypted-blob>"
}
```
`context` is plain and readable by the agent's tools via `AgentRun.request_context`.  
`user_payload` decrypts (wxO-side only) to `{ "name": "Alice Smith", "custom_user_id": "<sub>" }`.

### Identity in request body (REST API only)

```json
{
  "message": { "role": "user", "content": "..." },
  "agent_id": "...",
  "context_variables": {
    "roles":         ["trip_booker"],
    "email":         "user@example.com",
    "sso_token":     "<app-id-access-token>",
    "wxo_run_id":    "",
    "wxo_thread_id": "",
    "wxo_user_name": ""
  }
}
```

---

## Security Comparison

| Property | REST API | REST API Secure | Embedded web chat |
|---|---|---|---|
| **Credential blast radius** | ⚠ High — a leaked API key grants full tenant access to any caller | ✅ Low — the private key only signs JWTs; it cannot call wxO directly | ✅ Low — same as REST API Secure |
| **Sensitive data in transit** | ⚠ Identity fields in `context_variables` are plain JSON in the request body (TLS-protected but not encrypted at the application layer) | ✅ `user_payload` RSA-encrypted; only wxO backend can decrypt | ✅ Same as REST API Secure |
| **Identity trust model** | ⚠ wxO trusts the API key, not the user — identity is asserted in the body, not signed | ✅ Identity is cryptographically bound in the JWT, signed with the private key; forgery requires the private key | ✅ Same as REST API Secure |
| **Token lifetime** | ⚠ API key is long-lived; IAM token cached up to 1h in process memory | ✅ JWT minted per request, 1h expiry, no long-lived credential in memory | ✅ JWT minted per browser session, 1h expiry |
| **Key rotation** | Requires API key rotation (tenant-level operation) and server restart | Replace key pair + upload new public key to wxO; server restart only | Same as REST API Secure |
| **User identity in wxO audit trace** | `trace.userId` = service account name, not the person | `trace.userId` = real App ID user UUID (`sub`) | `trace.userId` = real App ID user UUID (`sub`) |
| **`user_payload` encryption** | N/A | ✅ RSA-PKCS1v1.5, IBM's public key | ✅ Same |
| **Overall** | Adequate for trusted server deployments; API key is the weak link | Strong — no long-lived service credential; per-user identity signed and partially encrypted | Strong — same crypto as REST API Secure; widget also limits the attack surface |

---

## Feature Comparison

| Feature | REST API | REST API Secure | Embedded web chat |
|---|---|---|---|
| Custom chat UI | ✅ Full control | ✅ Full control | ❌ IBM widget only |
| Multi-turn conversation | ✅ Via synthetic `thread_id` SSE event | ✅ Via `data.thread_id` in any NDJSON line | ✅ Widget-managed |
| OBO identity propagation to downstream systems | ❌ Uses IAM Bearer token — no per-user identity at the wxO connection layer | ✅ Uses the same RS256 JWT + embed security headers as the widget — `oauth_auth_on_behalf_of_flow` connections work | ✅ `oauth_auth_on_behalf_of_flow` connections work |
| No API key required | ❌ | ✅ | ✅ |
| RSA embed security setup required | ❌ | ✅ | ✅ |

---

## When to Use Each Surface

| Scenario | Recommended |
|---|---|
| Production custom UI, with built-in OBO identity propagation, compliance, audit trail, no long-lived service credential | REST API Secure |
| Corporate portal with SSO, OBO identity propagation to downstream enterprise systems, and IBM-managed UI | Embedded web chat |
| Quick prototype, API key available, no compliance requirements | REST API |
