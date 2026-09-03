# Authorization - RBAC in watsonx Orchestrate

## 0. Read this first — what puts `roles` in the context?

Every option below reads `roles` from the request context. Nothing puts them there by
default. On a bare REST API call the entire tool context is four keys:

```json
{"wxo_run_id": "...", "wxo_tenant_id": "...", "wxo_thread_id": "...",
 "wxo_user_name": "Auto-generated service credentials"}
```

No `roles`, no `sso_token`, no `email`, no `sub`. So **before choosing an option, answer:
what wires identity into my context?** There are exactly two answers:

| Path | How roles arrive | Trust |
|---|---|---|
| **Embedded web chat / OBO** | Your backend signs a JWT whose `context` carries `roles` and `sso_token`, sourced from the IDP's `id_token`. Orchestrate decrypts and injects it. | ✅ Proven — the client cannot forge it |
| **REST API Secure** | Your backend signs an RS256 JWT whose `context` carries `roles` and `sso_token`; `user_payload` is RSA-encrypted so only the wxO backend can read it. Same crypto path as embedded web chat. | ✅ Proven — same trust model as embedded web chat; private key never leaves your backend |
| **REST API** | Your app passes them in the request body, and the agent's **`context_variables` allowlist** admits them (SKILL §2.4) | ⚠ **Asserted** — only as good as your API key hygiene |

Both work. They differ entirely in *who is trusted*, which is §8.

⚠ **The `context_variables` allowlist is exclusive** — allowlisting `roles` and `email`
silently removes `wxo_run_id` / `wxo_thread_id` from your tools unless you list those too.
See SKILL §2.4.

---

## 1. The plugin API surface

```python
from ibm_watsonx_orchestrate.agent_builder.tools.types import (
    PythonToolKind, PluginContext, PluginViolation,
    AgentPreInvokePayload, AgentPreInvokeResult,
    AgentPostInvokePayload, AgentPostInvokeResult,
)
```

| Type | Fields |
|---|---|
| `AgentPreInvokePayload` | `agent_id`, `messages`, **`tools`**, `headers`, **`model`**, **`system_prompt`**, `parameters`, `context` |
| `AgentPreInvokeResult` | `continue_processing`, `modified_payload`, **`violation`**, `metadata` |
| `PluginViolation` | `reason`, `description`, `code`, `details` |
| `PluginContext` | `state`, `global_context`, `metadata` |

**`tools`** and **`violation`** are rewritable per caller, but ignored by wxO.

`PythonToolKind`: `TOOL`, `JOIN_TOOL`, `AGENTPREINVOKE` (`"agent_pre_invoke"`),
`AGENTPOSTINVOKE` (`"agent_post_invoke"`).

⚠ **`kind=` registers server-side only.** The locally computed spec leaves
`binding.python.type` as `None`; import populates it (`agent_pre_invoke` for a plugin,
`None` for an ordinary tool). Checking locally gives a false negative — check after import.

Attach on the agent:
```yaml
plugins:
  agent_pre_invoke:  [aaa_lab_gate_violation]
  agent_post_invoke: []
```

---

## 2. The four options

| | Runs at | Roles from | HTTP/turn | Blocks before LLM | Revocation lag | Skippable by the model? |
|---|---|---|---|:---:|---|:---:|
| **A** | inside a tool | JWT context | 0 | ❌ | token expiry | **yes** |
| **B** | inside a tool | `/userinfo` | 1 | ❌ | immediate | **yes** |
| **C** | pre-invoke plugin | JWT context | 0 | ✅ | token expiry | no |
| **D** | pre-invoke plugin | `/userinfo` | 1 | ✅ | immediate | no |

### Choosing

- **A/B** are checks permissions in the same tool that contains the business logic.
- **C/D are real gates** — verified: with the gate attached and the role absent,
  `tools_called` is `[]` and the model never runs. All-or-nothing, though.
- **B/D** buy immediate revocation for one HTTP call per turn, *if* your IDP serves roles
  from `/userinfo` — App ID with IBMid federation does not (§4).

## 3. Option A — check inside the tool

```python
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.run.context import AgentRun

REQUIRED_ROLE = "trip_booker"

@tool()
def book_trip(context: AgentRun) -> BookingResult:
    """Check whether the logged-in user holds the 'trip_booker' role and books the trip.

    Args:
        context (AgentRun): Injected agent-run context carrying roles and sso_token.

    Returns:
        BookingResult: The booking result.
    """
    roles = context.request_context.get("roles", [])
    subject = context.request_context.get("sub") or context.request_context.get("email", "unknown")
    if REQUIRED_ROLE not in roles:
        raise PermissionError(f"Access denied: '{subject}' lacks '{REQUIRED_ROLE}'. Has: {roles}")

    ...
    return BookingResult()
```

## 4. Option B — validate against the IDP

Same placement, but call the IDP's `/userinfo` with the `sso_token` so role changes take
effect immediately, and optionally verify the token's RS256 signature against JWKS first:

```python
jwks_client = PyJWKClient(f"{ISSUER}/publickeys", cache_keys=True)
signing_key = jwks_client.get_signing_key_from_jwt(token)
claims = pyjwt.decode(token, signing_key.key, algorithms=["RS256"],
                      issuer=ISSUER, options={"verify_aud": False})
```

Needs `PyJWT>=2` and `cryptography` in the tool's `requirements.txt`.

⚠ **Roles are usually NOT in `/userinfo`.** Confirmed in the field for **IBM App ID with
IBMid federation**: `/userinfo` returns the profile with **no `roles` key at all**; the
roles live in the **`id_token` claims** instead. So "Option B for immediate revocation"
only works if your IDP actually serves roles there — otherwise B degrades to "profile
lookup plus roles from the same token A would have used", with an extra HTTP call and the only benefit to verify recent role assignments.

**App ID setup required to get roles into the token at all:**
1. Define the role (App ID → Profiles and roles → Roles) with `scopes: ["roles"]` and your
   `application_id`.
2. Assign it to a user profile.
3. **Map it into the token** — `PUT /management/v4/<tenant>/config/tokens` — or the claim
   never appears in the `id_token` and every option silently sees no roles.

Step 3 is the one people miss; the symptom is an empty `roles` list with correctly
configured roles in the console.

## 5. Option C — block the turn

A pre-invoke plugin that denies before any tool or model runs. With
the gate attached and the required role absent, `tools_called` is `[]` and the model is
never invoked; with the role present the same agent runs normally.

⚠ **Two things you must get right, both learned the hard way:**

**1. `plugins:` takes `PluginRef` objects, not strings.**
```yaml
plugins:
  agent_pre_invoke:
    - plugin_name: rbac_gate      # ✅  NOT  `- rbac_gate`
  agent_post_invoke: []
```
A bare string fails import with
`Input should be a valid dictionary or instance of PluginRef`.

**2. `PluginViolation` data (its `code`/`reason`/`details`) does not appear in **either the run payload or the
trace**, and the user sees **their own message echoed back**. Rewrite
`payload.messages[-1].content.text` to the refusal, always pass the payload (never `None`
— that yields a generic *"Plugin execution failed"*), and treat `violation` as optional
future-proofing rather than an audit record.

## 6. Plugins vs Controls — the same hook

`PythonToolKind.AGENTPREINVOKE == "agent_pre_invoke"` — identical to one of the six
2.15.0 control hooks (`agent_pre_invoke`, `agent_post_invoke`, `tool_pre_invoke`,
`tool_post_invoke`, `prompt_pre_fetch`, `prompt_post_fetch`).

| Reach for | When | Why |
|---|---|---|
| **Control** | Generic, configurable policy: PII redaction, content guardrails, secrets detection, rate limiting | Declarative, no code, bindable to many agents, `--priority` ordered. Verified to enforce at runtime. |
| **Plugin** | *Your* business logic: role maps, entitlement lookups, tool filtering | Anything a config blob cannot express |

**They compose:** a control sanitises the payload; a plugin decides entitlement.

⚠ **Ordering between them is unverified.** Do not rely on one running before the other,
and specifically do not have a plugin trust input that you assume a control has already
sanitised — until you have tested it on your tenant.

⚠ **A control-induced refusal looks like a model refusal.** With a PII control bound, the
agent declines because the values were redacted before it saw them — not because of your
RBAC. Run `orchestrate controls list --agent <name>` before debugging a prompt.

---

## 7. The trust boundary

Every option trusts roles that **something upstream wrote**. Ask who can write them.

| Path | Trustworthy? | Why |
|---|---|---|
| Embedded web chat / OBO | ✅ | Roles ride in a backend-signed JWT with `user_payload` encrypted to IBM's public key. A client cannot forge it — the private key never leaves your backend. Confirmed field architecture: browser never holds the signing key or the OIDC client secret. |
| REST API Secure | ✅ | Uses the same RS256 JWT + RSA-encrypted `user_payload` as the web chat widget. `trace.userId` is the real user UUID. The private key never leaves your backend — trust level is equivalent to embedded web chat. |
| REST API (plain `context_variables`) | ⚠ **asserted, not proven** | Your app sets them, and a caller with the API key can claim any role. Acceptable when the key is server-side and roles are derived from a validated IDP token. **Never** acceptable if the key can reach a browser. |
| Browser calling `/v1/orchestrate/runs` directly | ⛔ **never** | The user can claim any role. Keep the instance API key server-side, always. |

**Defence in depth:** validate the `sso_token` signature against the IDP's JWKS inside the
tool (Option B/D) rather than trusting the claim as delivered. One HTTP call, and it
closes the gap between "the context says trip_booker" and "the IDP agrees".

---

## 8. Debug probe

When roles do not arrive, dump the context rather than guessing — the surface, not the
code, is usually the cause:

```python
@tool()
def debug_context(context: AgentRun) -> str:
    """Dump every key the runtime passes to this tool.

    Args:
        context (AgentRun): Injected agent-run context.

    Returns:
        str: JSON of all context keys and their values.
    """
    rc = context.request_context
    return json.dumps({k: rc.get(k) for k in rc.keys()}, default=str)
```

⚠ Redact tokens before logging — prefix only. A full `sso_token` in a trace is a
credential in a log.
