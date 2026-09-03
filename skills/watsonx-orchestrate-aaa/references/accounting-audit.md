# Accounting - the audit trail

Authentication proves *who*; authorization decides *what they may do*; **accounting is what you can show afterwards.**

---

## 1. The starting point

On the plain **REST API** surface the tool context is:

```json
{"wxo_run_id": "...", "wxo_tenant_id": "<account-id>_<instance-id>",
 "wxo_thread_id": "...", "wxo_user_name": "Auto-generated service credentials"}
```

There are **three identity shapes** across the three production surfaces:

| Surface | `trace.userId` | Real user recovery |
|---|---|---|
| **Embedded web chat** | Real App ID UUID (`sub`) — directly readable | None needed |
| **REST API Secure** | Real App ID UUID (`sub`) — directly readable | None needed; the RS256 JWT carries the user `sub` |
| **REST API** | Service account (e.g. `0600000RGH`) — the API key identity, not the person | Decode the `sso_token` JWT in observation inputs to extract `sub` |

On the plain REST API surface, Orchestrate records the `sso_token` context variable
verbatim in every observation's input. Decoding its JWT payload yields `sub`, `tenant`,
`iss`, `roles`, `email_verified`, and `exp` — sufficient to identify the real end user.

That is the central accounting nuance for the plain REST API: **`trace.userId` ≠ real
user.** You recover the real user by decoding the `sso_token` JWT — not from a top-level
field. The `sub` claim is the App ID UUID of the person; email and other profile attributes
can be resolved on demand via the App ID management API:
`GET /management/v4/{tenant}/users/{sub}`

On **REST API Secure** (and embedded web chat), `trace.userId` is already the real user
UUID — no JWT decode required. The RS256 JWT the server mints carries the user's `sub`
directly in its `user_payload`, which wxO decrypts and uses to populate `trace.userId`.

---

## 2. What is native

| Question | Where |
|---|---|
| Which run / conversation? | `wxo_run_id`, `wxo_thread_id` in tool context |
| Which tenant and instance? | `wxo_tenant_id` = `<account-id>_<instance-id>` |
| Which user? | Embedded web chat and REST API Secure: `trace.userId` directly (real user UUID). REST API (plain): `sub` from `sso_token` JWT in observation inputs. `sso_token` must be in `context_variables` on the plain REST API surface. |
| What did the agent do? | `step_history` on the run; observations in the trace |
| Which tools, in what order, with what arguments? | trace observations |
| Token counts per call | `observation.usage` on generation observations |
| Filter traces by user or session | `observability traces search --user-id --session-id` |
| Was sensitive data present? | `pii_filter` control with `log_detections`; redaction visible in the trace |
| Was a request blocked, and why? | `PluginViolation.code` / `.details` from a pre-invoke plugin |

**A worked example of native evidence:** with a `pii_filter` control bound, the
exported trace shows `SSN [PHI-REDACTED]` in the LLM input and the raw value is absent
from the trace entirely. That is a defensible artifact — it demonstrates the control
executed *and* that the sensitive value never reached the model.

---

## 3. What you must build

### 3.1 Evidence retention ⭐ the important one

On both surfaces the real user's `sub` (App ID UUID) is recorded in every trace — directly
as `trace.userId` on embedded web chat, and inside the `sso_token` JWT payload in
observation inputs on REST. Email and other profile attributes can always be resolved on
demand: `GET /management/v4/{tenant}/users/{sub}`.

What the trace **cannot** do is outlive the platform's retention window. Export the traces
you must keep:

```
observability traces export --trace-id <id>
```

If your compliance policy requires evidence older than the retention window, maintain your
own export store. A minimal audit record per turn:

```
user_sub | thread_id | run_id | agent | timestamp | roles_at_call_time
```

`run_id` and `trace_id` come back in the `/v1/orchestrate/runs` response — one row per
turn gives you a durable pointer from a person to a trace.

> **⚠ Prerequisite:** this path works only when the calling application passes `sso_token`
> in `context_variables`. If `sso_token` is omitted, no user identity is recorded in the
> trace at all — `trace.userId` stays the service account and the `sub` claim is absent.

### 3.1a ⚠ The allowlist trap that breaks the join

The agent's `context_variables` allowlist is **exclusive** — it filters the platform's own
keys as well as caller-supplied ones. Allowlist `roles` and `email` to make RBAC work, and
`wxo_run_id` / `wxo_thread_id` **disappear from your tools**, silently.

That is precisely the join in §3.1. Always allowlist them alongside your identity fields:

```yaml
context_variables: [roles, email, sso_token, wxo_run_id, wxo_thread_id, wxo_user_name]
```

### 3.1b Example artifact

This sample [script](https://github.com/nheidloff/watsonx-orchestrate-sso-example/blob/7dd491411fc0a191ded1bc21445db568481ff2cb/trip_booking/read-last-conversation.sh) reads the following information from a trace. The two surfaces produce different identity shapes — both are shown below.

#### Embedded web chat

| Field | Value |
|---|---|
| Status | **ACCESS DENIED** |
| Agent / Agent ID / Environment | `trip_booking_agent` · `54688d69-…` · `live` |
| Total latency · Observations | 557 ms · 4 |
| **LLM invoked** | **No — blocked by pre-invoke gate** |
| Tool calls · Errors | 0 · 0 |
| wxO user ID | `a0a19b17-…` (real user — same as App ID `sub`) |
| App ID `sub` | `a0a19b17-…` |
| email | *[REDACTED by platform]* |
| wxO roles (context) · App ID roles (JWT) | none ← access denied · none |
| clientID | `trip-booking-app` |

#### REST API (plain)

| Field | Value |
|---|---|
| Status | **ACCESS DENIED** |
| Agent / Agent ID / Environment | `trip_booking_agent` · `b3cbc949-…` · `live` |
| Total latency · Observations | 450 ms · 4 |
| **LLM invoked** | **No — blocked by pre-invoke gate** |
| Tool calls · Errors | 0 · 0 |
| wxO user ID | `0600000RGH` (service account / API key identity) |
| App ID `sub` | `a0a19b17-dfa8-4950-89f2-a1a6e62b10a4` (from `sso_token` JWT decode) |
| email | *[REDACTED by platform]* |
| wxO roles (context) · App ID roles (JWT) | none ← access denied · none |
| clientID | `—` (intentional — plain REST API clients are not wxO web chat channels) |

**Why the three look different:** on the embedded web chat and REST API Secure surfaces, wxO
knows the authenticated user directly — the RS256 JWT is signed with the backend's private key
and `trace.userId` is populated with the real user's UUID. On the plain REST API surface, wxO
sees only the API key (a service account) at the top level, so `trace.userId` is the service
account name (`0600000RGH`). The real user's identity lives inside the `sso_token` the
application injected into `context_variables`; the script decodes that JWT to surface the App
ID `sub` and roles separately. REST API Secure avoids this extra step because the user `sub`
is already in the JWT `user_payload` that wxO decrypts.

The management API call below resolves `sub` → email for either surface:
`GET /management/v4/{tenant}/users/{sub}`

Why this is the right shape: it answers *who*, *what was refused*, *whether the model ever
saw the request*, and *which roles were present at decision time* — on one page, per
conversation, derived from the trace rather than from application logs.

⚠ **`email` comes back `[REDACTED by platform]` in the trace on both surfaces.** Use the
App ID management API to resolve `sub` → email on demand:
`GET /management/v4/{tenant}/users/{sub}`

### 3.2 What `--user-id` and `--session-id` actually filter on

`observability traces search` accepts both. They are only useful if something *set* them.
Confirm on your surface what populates them before promising user-level trace search —
on the REST API, with no identity in context, assume nothing does.

### 3.3 Retention

Traces are an observability store, not an archive. Establish the retention window on your
tenant **before** relying on traces as compliance evidence, and export what you must keep.
`observability traces export --trace-id` writes JSON you can retain yourself.

---

## 4. Why scope is an accounting decision, not just a security one

The strongest argument for `member` over `team` is not access control — it is the trail.

| | `member` | `team` |
|---|---|---|
| Downstream audit log shows | the actual person | the service account |
| "Who approved this?" | answerable | **unanswerable** |
| Offboarding | user's access ends with their account | the shared credential still works |
| Blast radius of a leaked credential | one user | everyone |

A `team` connection to a system that records who did what **permanently destroys** that
information at the boundary. No amount of Orchestrate-side logging recovers it — the
downstream system genuinely believes the service account did it.

Where a shared credential is unavoidable but attribution is required: pass the end user's
identity as an explicit application-level field the downstream system records (many APIs
accept an `on_behalf_of` or `X-Requested-For` header). It is weaker than real per-user
auth — the downstream cannot verify the claim — but it beats nothing. Say plainly which
of the two you have.

---

## 5. The scheduled-run trap, in accounting terms

A scheduled run carries the identity of **whoever created the schedule**. Every downstream
record it produces names that person, forever, regardless of who the data concerns or who
now owns the process. When they leave, the trail points at someone who no longer works
there — and the run silently fails.

Use `team`-scoped `oauth_auth_client_credentials_flow`, which at least names the
*application* honestly rather than misattributing to a human (SKILL §3.3).

---

## 6. Compliance evidence checklist

Before telling a client their deployment is auditable, confirm you can produce all seven:

| # | Evidence | Where it comes from |
|---|---|---|
| 1 | Every agent invocation is attributable to a person | **Embedded web chat / REST API Secure:** `trace.userId` is the real user UUID directly. **REST API (plain):** `sub` from `sso_token` JWT in observation inputs — requires `sso_token` in `context_variables`. ⚠ If `sso_token` is **not** in `context_variables` on the plain REST API surface, no user identity is recorded at all. Email resolves on demand via App ID management API on all surfaces. |
| 2 | The identity was authenticated, not asserted | IDP token validated against JWKS (Option B/D) |
| 3 | Authorization was enforced, not requested | A pre-invoke plugin or control — **not** Option A/B alone |
| 4 | Denials are recorded with a reason | `PluginViolation.code` + `details` |
| 5 | Downstream systems recorded the real user | `member` scope or OBO — impossible under `team` |
| 6 | Sensitive data handling is demonstrable | `pii_filter` control with `log_detections`; redaction visible in traces |
| 7 | The evidence outlives the trace retention window | Exported traces plus your own records |

Items 1, 5 and 7 are the ones deployments usually fail — and all three must be designed in
up front. None can be retrofitted.

