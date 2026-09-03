---
name: watsonx-orchestrate-aaa
description: >-
  Authentication, authorization, and accounting (AAA) for IBM watsonx Orchestrate
  agents — choosing and configuring connections, propagating end-user identity to
  downstream enterprise systems, enforcing role-based access control, and producing
  an audit trail. Use this whenever a wxO question involves connections, credentials,
  `orchestrate connections`, any of the eight connection kinds (`basic`, `bearer`,
  `api_key`, `key_value`, or the four `oauth_*_flow` kinds), OAuth, SSO, IDP, App ID,
  Entra, Okta, Keycloak, JWT, `sso_token`, on-behalf-of / OBO, `member` vs `team`
  credential scope, RBAC, roles, permissions, `agent_pre_invoke` plugins, per-user
  identity, service accounts, "who is the agent acting as", audit trails, or
  compliance evidence. Also use it for questions like "how do I connect Orchestrate
  to Workday/SAP/ServiceNow as the logged-in user", "why does my agent see no roles",
  "how do I stop unauthorized users calling this tool", or "how do I prove who did
  what".
  **Complements the `watsonx-orchestrate` skill — it does not replace it.** That skill
  owns the build/test/deploy lifecycle and connection *mechanics*; this one owns which
  auth type to choose, why, and how identity and authorization actually behave at runtime.
metadata:
  enabled: true
---

# watsonx Orchestrate — Authentication, Authorization & Accounting

Enterprise agents act on behalf of **named individual people**. Workday returns *this
employee's* HR record. SAP books the expense in *this person's* name. ServiceNow stamps
*this user* on the ticket. Downstream access control, row-level visibility, and the audit
trail all depend on the platform knowing who is calling — and on that identity surviving
the trip from the browser, through Orchestrate, into the tool, and out to the enterprise
system.

> **Load this alongside [`watsonx-orchestrate`](../watsonx-orchestrate/SKILL.md), not
> instead of it.**
>
> | That skill owns | This skill owns |
> |---|---|
> | Connection *mechanics*: YAML shape, `connections` CLI verbs, `set-credentials`, how a tool reads a connection at runtime | *Which* auth kind to choose and why; how identity actually behaves per access surface |
> | Agents, tools, flows, KBs, controls, the build → import → test → deploy lifecycle | RBAC enforcement, identity propagation, the audit/accounting trail |
>
> If the question is "how do I create a connection", that is the base skill. If it is
> "which connection should this be, and will the user's identity reach Workday", it is this one.

---

## 1. The five Dimensions — and which one decides

Every connection decision has five inputs. They are **not** equally weighted.

| # | Dimension | Options |
|---|---|---|
| **1** | **User access surface** ⭐ | REST API · REST API Secure · Embedded web chat · Native UI · Scheduled/background |
| 2 | Credential scope | `member` (per user) · `team` (shared) |
| 3 | Authentication type | the eight below and in [references/authentication-types.md](references/authentication-types.md) |
| 4 | Tool type | Python · local MCP · remote MCP |
| 5 | Environment | Developer Edition · SaaS/on-prem |

**Dimension 1 decides the rest.** It determines which auth kinds are even *reachable* at
runtime, and it is the one most designs get wrong — because the surface people build
against (the Orchestrate UI) is not the surface production users get.

**Answer this first, before anything else:** *how will real users reach this agent?*

---

## 2. The Access Surfaces

### 2.1 Who uses it?

| Surface | Who really uses it |
|---|---|
| **REST API** | Production users, via a custom application using an API key (IAM Bearer token) |
| **REST API Secure** | Production users, via a custom application using an RS256 JWT and RSA-encrypted identity ⭐ recommended for enterprise production |
| **Embedded web chat** | Production users leveraging the IBM web chat widget, for example on a corporate portal |
| **Native UI** | Developers, during build and test |
| **Scheduled** | No interactive user |

### 2.2 Available Context

| Surface | wxO Context Keys | Custom Context Keys |
|---|---|---|
| **REST API** | `wxo_run_id`, `wxo_tenant_id`, `wxo_thread_id`, `wxo_user_name` (= service account) | `email`, `roles`, `sso_token`, `wxo_run_id`, `wxo_thread_id` |
| **REST API Secure** | `wxo_run_id`, `wxo_tenant_id`, `wxo_thread_id`, `wxo_user_name` **plus** `email`, `roles`, `sso_token`, `clientID` | --- |
| **Embedded web chat** | `wxo_run_id`, `wxo_tenant_id`, `wxo_thread_id`, `wxo_user_name` **plus** `email`, `roles`, `sso_token`, `clientID` | --- |
| **Native UI** | the logged-in wxO user | --- |
| **Scheduled** | the identity of **whoever created the schedule** | --- |

### 2.3 Authentication Types

| Surface | Available Authentication Types | Not available Authentication Types |
|---|---|---|
| **REST API** | `basic`, `bearer`, `api_key`, `key_value`, `oauth_auth_client_credentials_flow` (`team`) | All interactive OAuth; OBO as a *Connection* |
| **REST API Secure** | Same as REST API **plus `oauth_auth_on_behalf_of_flow`** — the RS256 JWT + embed security headers unlock OBO connections | Auth-code / password flows |
| **Embedded web chat** | `basic`, `bearer`, `api_key`, `key_value`, `oauth_auth_client_credentials_flow` (`team`) **plus `oauth_auth_on_behalf_of_flow`** | Auth-code / password flows |
| **Native UI** | Everything interactive: auth-code, password, client-credentials | OBO |
| **Scheduled** | `team`-scoped static kinds and `oauth_auth_client_credentials_flow` | Anything `member`-scoped |

### 2.4 context_variables in REST API surfaces and allowlist

On the REST API surface **with no `context_variables` set on the agent**, the complete
tool context is four keys:

```json
{
  "wxo_run_id":    "10c0bc36-…",
  "wxo_tenant_id": "665515354028bf967bbcdb8ef30c2bca_e5fbd377-…",
  "wxo_thread_id": "563ebd85-…",
  "wxo_user_name": "Auto-generated service credentials"
}
```

`wxo_user_name` is the **API key's** display name, not a person.

Key information is missing: **no `roles`, no `sso_token`, no `email`, no `sub`, and no
`wxo_email_id`**.

Three consequences:

1. **Nothing about the end user arrives by default.** Every RBAC option reads `roles`
   from context; with no allowlist and no caller-supplied context there are no roles, and
   Options A-D enforce nothing. You must deliberately wire identity in.
2. **On the REST surface, authenticating the end user is entirely your application's
   job.** Orchestrate contributes nothing — `wxo_user_name` is the API key's own name.
   Your app authenticates against the IDP and passes identity in; *your tool* then has to
   decide whether to trust it (§4.6).
3. `wxo_tenant_id` is `<account-id>_<instance-id>` — the exact shape the Observability
   SDK requires for `TENANT_ID`. Useful for the accounting leg (§5).

The agent YAML field the base skill describes only as *"list of non-empty strings"* is in
fact **the allowlist that controls which context fields are injected into your tools**.
It is the mechanism that makes per-user identity work.

```yaml
context_variables:      # exactly what reaches the tool. Nothing else does.
  - roles
  - email
  - sso_token
  - wxo_run_id          # ⚠ re-add the platform keys or you LOSE them (see below)
  - wxo_thread_id
```

The caller supplies matching values in the `/v1/orchestrate/runs` body — **both `context`
and `context_variables` as the body key work**:

```json
{"message": {"role": "user", "content": "..."},
 "agent_id": "...",
 "context": {"roles": ["trip_booker"], "email": "user@example.com"}}
```

Measured behaviour:

| Agent `context_variables` | Caller supplies | Tool actually sees |
|---|---|---|
| unset / empty | anything | the 4 platform `wxo_*` keys only — **caller values are dropped** |
| `[roles, email, custom]` | those three | exactly those three — **the `wxo_*` keys are gone** |
| `[roles, email, custom, wxo_run_id, wxo_thread_id, wxo_user_name]` | those three | all six |

⚠ **It is an *exclusive* filter, not an additive one — and it filters the platform's own
keys too.** The moment you allowlist identity fields, `wxo_run_id` and `wxo_thread_id`
silently vanish from your tools unless you list them as well. That quietly breaks the
identity→run join the accounting leg depends on (§5), and nothing warns you.

**Per-user identity over the plain REST API does work.** But the roles are **asserted by the caller**, not proven by the platform — which makes §4.6 the load-bearing section.

On **REST API Secure**, the application server signs an RS256 JWT with a private key that never leaves the backend, and sensitive identity fields are RSA-encrypted inside `user_payload` so only the wxO backend can decrypt them. This raises the trust level to that of embedded web chat — see `references/production-surfaces.md`.

---

## 3. Credential scope: `member` vs `team`

| Scope | Who sets credentials | Applies to |
|---|---|---|
| `member` | Each end user | Only that user's requests |
| `team` | An administrator, once | All users of the agent |

### 3.1 The enterprise default is `member`

Using a shared service account where the downstream system enforces per-user access means:
every user can see every other user's data; the audit trail names the service account
rather than the human; and permission boundaries in the downstream system are bypassed
wholesale.

**Use `team` only when both hold:** the downstream system has no per-user access model,
*and* no policy requires a per-user audit trail.

- Typical `team`: web search APIs, monitoring endpoints, LLM gateways, shared catalogues.
- Typical `member`: Workday, SAP, ServiceNow, Salesforce, Microsoft 365, GitHub.

### 3.2 `member` constraints

- **Native UI** — the user is prompted in chat on first use; the credential is stored and reused.
- **Developer Edition** — no prompt UI; each developer runs `orchestrate connections set-credentials` themselves.
- **REST API** — no prompt is possible; an administrator must pre-provision per user.
- **`key_value` has no `member` scope at all** — it is always `team`.

### 3.3 ⛔ Never use `member` scope in a scheduled agent

A scheduled run carries the identity of **whoever created the schedule**, not of any
present user.

| Situation | Result |
|---|---|
| Creator's credentials valid | Runs — as *that person*, for all data it touches |
| Creator leaves / token expires | **Silent failure**, with nobody present to re-authenticate |
| Someone else takes the schedule over | Still runs as the original creator until re-created |

The correct pattern for any run without an interactive user is **`team`-scoped
`oauth_auth_client_credentials_flow`** — short-lived tokens, automatic refresh, no human
dependency. Static `team` kinds are acceptable with a real rotation process.

**Audit your deployment:** any scheduled agent whose tools use a `member` connection is a
latent outage. It works during setup, because the creator is still active.

---

## 4. Authorization — RBAC

Authentication establishes *who*. Authorization decides *what they may do*. In wxO there
are two enforcement altitudes and, as of 2.15.0, both a hand-written and a declarative
mechanism at the same hook.

### 4.1 The four options

| | Where it runs | Roles from | HTTP/turn | Blocks before the LLM? | Revocation lag |
|---|---|---|---|---|---|
| **A** | Inside a tool | JWT context | 0 | No | Token expiry |
| **B** | Inside a tool | `/userinfo` | 1 | No | Immediate |
| **C** | `agent_pre_invoke` plugin | JWT context | 0 | **Yes** | Token expiry |
| **D** | `agent_pre_invoke` plugin | `/userinfo` | 1 | **Yes** | Immediate |

**C and D are real gates** but all-or-nothing: an unprivileged user gets no agent at all.

### 4.2 Denial with Option C and D (rewrite the message)

`AgentPreInvokeResult` carries `violation: Optional[PluginViolation]` with `reason`,
`description`, `code`, `details`. Setting it does block the turn — but **the content goes
nowhere observable**. 

**You must rewrite the message text** or the user gets their own words returned as the
   agent's reply — which reads like a bug, not a refusal:

   ```python
   result = AgentPreInvokeResult()
   result.continue_processing = False
   if payload and payload.messages:
       payload.messages[-1].content.text = (
           f"Access denied: your account ({subject}) does not have the "
           f"'{REQUIRED_ROLE}' role required to use this service."
       )
   result.modified_payload = payload          # never None — None gives "Plugin execution failed"
   result.violation = PluginViolation(...)    # harmless; sets no observable state today
   ```

Keep populating `violation` if you like; it costs nothing and may become observable in a
later release. Just do not rely on it, and do not count it as your audit trail.

### 4.3 Denial with Option A and B

```python
@tool()
def get_patient_record(patient_id: str, context: AgentRun) -> Record:
    roles = context.request_context.get("roles", [])
    if REQUIRED_ROLE not in roles:
        raise PermissionError(f"'{REQUIRED_ROLE}' role required to read patient records.")
    ...
```

### 4.4 Plugins vs Controls — same hook, different tool

`PythonToolKind.AGENTPREINVOKE == "agent_pre_invoke"` — byte-identical to one of the six
2.15.0 **control** hooks (base skill §4a). Both intercept at the same point.

| Reach for | When |
|---|---|
| **Control** | The policy is generic and configurable — PII redaction, content guardrails, secrets detection, rate limits. Declarative, no code, bindable to many agents at once. |
| **Plugin** | The policy is *your* business logic — role maps, entitlement lookups, tool filtering. Anything a config blob cannot express. |

⚠ **Ordering between a plugin and a control on the same hook is unverified.** Do not
depend on one running before the other, and do not rely on a control to sanitise input
that your plugin then trusts, until you have tested it on your tenant.

### 4.5 `kind=` registers server-side only

`@tool(kind=PythonToolKind.AGENTPREINVOKE)` leaves `binding.python.type` as `None` in the
locally computed spec, and it is populated **at import**:

| Tool | `binding.python.type` after import |
|---|---|
| plugin | `agent_pre_invoke` |
| ordinary tool | `None` |

Checking locally whether something registered as a plugin gives a **false negative**.
Check after import.

### 4.6 The trust boundary — the load-bearing question

Every RBAC option reads roles from context that **something upstream put there**. Since
a REST caller can simply assert `{"roles": ["trip_booker"]}` in the request body (§2.4),
this is not a footnote — it is the whole security argument. Ask: who can write that
context, and why do you trust them?

- **Embedded web chat / OBO:** roles ride inside a JWT the host backend signs, with
  `user_payload` encrypted to IBM's public key. Trustworthy *because* the client cannot
  forge it — the private key never leaves your backend.
- **REST API Secure:** uses the same RS256 JWT + RSA-encrypted `user_payload` as the web
  chat widget. The trust level is equivalent to embedded web chat — the private key never
  leaves your backend, and `trace.userId` is the real user UUID (not a service account).
- **REST API with plain context variables:** your app sets them. Trustworthy only to the
  extent the API key is protected. **Never build a browser client that calls
  `/v1/orchestrate/runs` directly with the instance API key and self-declared roles** — a
  user can trivially claim any role. Keep the key server-side and derive roles from a
  validated IDP token.
- **Belt and braces:** validate the `sso_token` signature against the IDP's JWKS inside
  the tool (Option B/D) rather than trusting the claim as passed.

---

## 5. Accounting — the third leg

Accounting is what a compliance reviewer asks about.

**What Orchestrate gives you natively** (mechanics in the base skill §6a):

| Question | Where the answer is |
|---|---|
| Which run, which conversation? | `wxo_run_id`, `wxo_thread_id` in tool context |
| Which tenant/instance? | `wxo_tenant_id` = `<account-id>_<instance-id>` |
| Which user? (embedded web chat) | `trace.userId` = real user UUID (App ID `sub`), directly readable |
| Which user? (REST API) | `trace.userId` = **service account** (e.g. `0600000RGH`), not the person. Real user is the `sub` claim inside the `sso_token` JWT recorded in observation inputs — requires base64 decode of the payload segment |
| What did the agent do? | `step_history` on the run; observations in the trace |
| Filter traces by user/session | `observability traces search --user-id --session-id` |
| Was sensitive data seen? | A `pii_filter` control with `log_detections`; redaction is visible in the trace |

The `sso_token` is passed in `context_variables` on both surfaces when your application
includes it. Decoding its JWT payload yields `sub`, `tenant`, `iss`, `roles`,
`email_verified`, and `exp` — sufficient to identify the real end user. If `sso_token`
is **not** passed in `context_variables`, no user identity is recorded at all.

`email` is redacted in traces on both surfaces — resolve it on demand via the App ID
management API: `GET /management/v4/{tenant}/users/{sub}`.

**What you may need to build yourself:** an export of the trace evidence. Traces have a
finite retention window; if your compliance policy requires records older than that window,
export them with `observability traces export --trace-id` and maintain your own store.
A minimal durable record per turn: `user_sub | thread_id | run_id | agent | timestamp |
roles_at_call_time`.

Design guidance and the compliance-evidence checklist: `references/accounting-audit.md`.

---

## 6. Decision guide

```
How will PRODUCTION users reach this agent?
│
├─ Embedded web chat on a corporate portal
│   └─ Already signed in via corporate SSO?
│       ├─ Yes → oauth_auth_on_behalf_of_flow, member       ← the enterprise pattern
│       └─ No  → static kinds/team (basic/bearer/api_key/key_value)
│
├─ Your own application over the REST API
│   └─ No OAuth redirect is possible at runtime.
│       ├─ Downstream is shared        → api_key / bearer / key_value, team
│       ├─ Downstream is per-user      → basic / api_key, member (admin-provisioned)
│       ├─ Need true per-user identity → authenticate in YOUR app, pass the IDP token
│       │    (asserted, not signed)      as a context variable, exchange in a Python
│       │                                tool (§2.4)
│       └─ Need cryptographic identity proof, OBO connections, or full audit trail
│            without decoding tokens  → REST API Secure: RS256 JWT + RSA-encrypted
│                                        user_payload, same trust as embedded web chat
│
├─ Scheduled / background — no user present
│   └─ ⛔ never member-scoped
│       → oauth_auth_client_credentials_flow, team          ← recommended
│
└─ Orchestrate native UI  (developers — not a production surface)
    ├─ per-user delegated  → oauth_auth_code_flow, member
    ├─ machine-to-machine  → oauth_auth_client_credentials_flow, team
    └─ legacy, basic only  → basic, member
```

Then: **does the downstream system enforce per-user access?** Yes → `member`. No → `team`.

Then: **which tool type?** Python for anything enterprise — full control of request
construction, retries, and multi-system calls. Local MCP takes `key_value` only. Remote
MCP takes everything except OBO and `key_value`.

---

## 7. Security ranking

| | Kind | Why |
|---|---|---|
| ✅ Best | `oauth_auth_client_credentials_flow` | Short-lived, auto-refreshed, no static secret in transit. The M2M standard. |
| ✅ Best | `oauth_auth_code_flow` | Short-lived; the user's password never reaches Orchestrate. |
| ✅ Best | `oauth_auth_on_behalf_of_flow` | Extends corporate SSO end to end; preserves per-user identity downstream. |
| ✅ Good | `api_key` | Easy to scope and rotate. |
| ✅ Good | `key_value` | Correct for config injection; `team` only. |
| ⚠ OK | `basic` | Legacy only. Needs disciplined password rotation. |
| ⚠ OK | `bearer` | Only if the issuer enforces expiry. Static tokens need a rotation process. |
| ⛔ Avoid | `oauth_auth_password_flow` | Orchestrate handles the raw password. Removed in OAuth 2.1. |
| ❓ Unknown | `oauth_auth_token_exchange_flow`, `oauth_auth_direct_access_flow` | Undocumented; behaviour not established. Do not design around them yet. |

`oauth_auth_implicit_flow` is absent from this table because **it does not exist**.

---

## 8. References

| File | Contents |
|---|---|
| [references/authentication-types.md](references/authentication-types.md) | All eight connection kinds — fields, when to use, scope guidance, YAML, per-surface and per-tool-type support, with the documentation corrections |
| [references/authorization-rbac.md](references/authorization-rbac.md) | RBAC Options A–D with working code, the plugin API surface, denial mechanisms, the trust boundary |
| [references/accounting-audit.md](references/accounting-audit.md) | The audit trail: what is native, what you build, the compliance-evidence checklist |
| [references/production-surfaces.md](references/production-surfaces.md) | Architecture, security, and feature comparison of the three production surfaces: REST API, REST API Secure, and Embedded web chat |

**External:** [connections/overview](https://developer.watson-orchestrate.ibm.com/connections/overview)
**External:** [Examples with Source Code](https://github.com/nheidloff/watsonx-orchestrate-sso-example)