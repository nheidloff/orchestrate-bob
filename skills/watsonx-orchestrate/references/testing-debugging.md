# Testing, evaluating & debugging wxO agents

---

## 1. The fast iteration loop

```bash
orchestrate env activate local
./import-all.sh                  # re-import overwrites by name
orchestrate agents list -v       # confirm presence + wiring
orchestrate chat start           # interactive test in the UI
```

Non-interactive, scriptable test (great for regression checks and CI):
```bash
orchestrate chat ask -n weather_agent "What's the weather in Paris?" -r
#   -r / --include-reasoning   show the reasoning trace
#   -l / --capture-logs        capture execution logs (custom agents)
#   -t / --thread-id <id>      continue an existing conversation
```

Snapshot a known-good definition into version control:
```bash
orchestrate agents export -n weather_agent --kind native -o agents/weather_agent.yaml --agent-only
orchestrate tools export -n get_weather -o tools/get_weather.exported.yaml
```
Use `--safe` on `tools`/`agents`/`knowledge-bases` import to be prompted before
overwriting.

---

## 1a. Post-deploy verification gate (test before handover)

**Deployed ≠ verified.** After `orchestrate agents deploy`, do not declare the
agent "done"/"ready" until it is tested or the human declines. This is a decision
gate: Bob **asks first**, then runs a lightweight smoke test and reports evidence.

### Step 1 — confirm deployment
```bash
orchestrate agents list -v | grep -i <name>          # present in the active env?
orchestrate agents export -n <name> --kind native -o /tmp/<name>.yaml --agent-only  # round-trips?
```

### Step 2 — ask the human (gate)
> "`<agent>` is deployed to `<env>`. Want me to smoke-test it before handover? I'll
> run 1 single-turn + 1 multi-turn test against `<env>` — real prompts, may invoke
> its tools, so I'll keep to **read-only** prompts." — Yes / No

If **No**: report "deployed; not tested at your request" and stop. If **Yes**, continue.

### Step 3 — derive the tests from the agent's own spec
Read the deployed definition and mine it for realistic prompts:
- `starter_prompts` → ready-made example user prompts (best source for Test 1).
- `description` / `instructions` → the intended job and the tool it should call.
- `tools` → which tool a correct answer should invoke; note any `READ_WRITE` tools.

### Step 4 — run the two tests

Important: Always run one single-turn test and additionally one multi-turn test:
1. Single-turn test
2. Multi-turn test
2a. first user input (this is input is different from 1. Single-turn test)
2b. second user input (and thread_id from 2a)

There are two ways to run these tests dependent on whether the `watsonx-orchestrate-adk` MCP server is available.

#### 1. `watsonx-orchestrate-adk` MCP server is available

Run the MCP server `watsonx-orchestrate-adk` tool `chat_with_agent` for single-turn and multi-turn conversations.

#### 2. `watsonx-orchestrate-adk` MCP server is not available
```bash
# Turn 1 — single-turn
./.bob/skills/watsonx-orchestrate/references/wxo-chat.sh -n <agent> "<derived prompt>"
# → { "thread_id": "3f92692d-...", "final_message": "...", ... }

# Turn 2 — resume
./.bob/skills/watsonx-orchestrate/references/wxo-chat.sh -n <agent> --thread-id <thread-id> -r "<derived prompt>"
# → { "thread_id": "3f92692d-...", "final_message": "...", "reasoning_trace": {"steps": [...]}, ... }
```

The follow-up must NOT restate the entity (e.g. "and what about the second one?").

### Step 5 — judge by behavior, not exact text
LLM output is non-deterministic — assert on behavior:
- **No error** and a coherent, **on-topic** answer.
- The **expected tool was invoked** (visible in the `-r` reasoning / `-l` logs) —
  not answered from the model's own memory when a tool was required.
- **Multi-turn:** the follow-up answer **uses prior context** (the agent remembered
  the entity/state from turn 1).

### Step 6 — safety (read-only by default)
- Default to **read-only prompts**. If the agent exposes `READ_WRITE`/`ADMIN` tools
  (creates tickets, sends mail, mutates data), do **not** craft prompts that trigger
  writes unless the human explicitly opts in.
- State the **target env** in the report — tokens/side-effects land there (mock/local
  vs SaaS/on-prem prod).

### Step 7 — emit `TEST_REPORT.md` and report status honestly
```markdown
# Agent Verification — <agent name> (<name>)
- Env: <local | nandaosi (SaaS) | on-prem>     Date: <YYYY-MM-DD>     LLM: <model>
- Tools available: <list>   (write-capable exercised? yes/no)

## Test 1 — single-turn
Prompt:   "<prompt>"
Result:   PASS | FAIL
Evidence: <response excerpt> · expected tool `<tool>` called: yes/no

## Test 2 — multi-turn (context retention)
Turn 1:   "<opening>"   →  <excerpt>
Turn 2:   "<follow-up>" →  <excerpt>     context retained: yes/no
Result:   PASS | FAIL

## Verdict: 2/2 passed — handover-ready   (or: 1/2 — <issue> — fix before handover)
```
Then say one of: **"deployed and tested (2/2 passed)"**, **"deployed; test N failed —
<reason>, recommend fixing before handover"**, or **"deployed; not tested at your
request."** For deeper, repeatable testing, escalate to the evaluations framework (§3).

---

## 2. Failure-mode table

| Symptom | Cause → Fix |
|---------|-------------|
| Agent import: required field error | Missing `spec_version`/`kind`/`name`/`description`. Add them. |
| Agent import: "cannot be used to create a native agent" | `kind` mismatch — set `kind: native`. |
| Import succeeds, agent ignores a tool | Weak tool `description`/docstring or instructions don't reference it. Improve docstring; name the tool in `instructions`. |
| Docstring/type-hint warnings on tool import | Missing type hints, or a blank line between `Args:` and `Returns:`. Fix Google-style docstring. |
| "name cannot contain spaces" | Use snake_case names for tools/toolkits/agents. |
| `ModuleNotFoundError` at tool runtime | Add the dep to the tool's `requirements.txt`, re-import with `-r`. Do **not** add `ibm-watsonx-orchestrate`. |
| Cross-file import error | Tool files must be self-contained — inline helpers/models. |
| 401/403 from a tool/KB | Connection not configured/credentialed or wrong `app_id`. `orchestrate connections list`; re-run `set-credentials`. |
| Model not found / no default | `orchestrate models list`; set `llm:` to a listed id or `orchestrate models config default`. |
| Flow won't compile | Signature must be `def build_<name>(aflow: Flow) -> Flow:`; `prompt` nodes need `system_prompt`; `map_*` expressions single-line. |
| Doc flow can't get the uploaded file | Don't ask the agent to upload — the `docproc` node prompts the user. Agent just invokes the flow. |
| Works locally, absent in prod | Wrong active env. `orchestrate env list` → activate the right one → re-import. |
| Need server-side detail | `orchestrate server logs`. Reset corrupt local state with `orchestrate server reset`. |

---

## 3. Built-in evaluation framework

Install the extra: `pip install "ibm-watsonx-orchestrate[agentops]"`.

| Command | Purpose |
|---------|---------|
| `orchestrate evaluations quick-eval` | Fast smoke evaluation of an agent |
| `orchestrate evaluations generate` | Generate test cases / datasets |
| `orchestrate evaluations evaluate` | Run a full evaluation against a dataset |
| `orchestrate evaluations analyze` | Analyze evaluation results |
| `orchestrate evaluations record` | Record interactions for later evaluation |
| `orchestrate evaluations validate-native` | Validate a native agent definition |
| `orchestrate evaluations validate-external` | Validate an external agent |

See the public `examples/evaluations/` directory at
https://github.com/IBM/ibm-watsonx-orchestrate-adk/tree/main/examples/evaluations
(evaluate, generate, analysis, red-teaming, rubric_evals, quick-eval,
with-file-upload, with-context-variable, external/native validation) for runnable
patterns. Run `orchestrate evaluations <cmd> --help` for current flags.

---

## 4. Observability / tracing

- Start the local server with IBM telemetry: `orchestrate server start -i`
- Inspect traces via `orchestrate observability traces` to
  see the agent's tool-call decisions, latencies, and errors — the best way to
  understand *why* an agent chose (or skipped) a tool.
  Example: `orchestrate observability traces search --last 1h`

### Logs in Developer Edition

When using the local Developer Edition (`orchestrate env list` local is active), 
logs can be accessed:

```bash
export LIMA_INSTANCE=ibm-watsonx-orchestrate
lima docker logs -f dev-edition-tools-runtime-1
lima docker logs dev-edition-wxo-tempus-runtime-1"
```

---

## 5. Programmatic flow testing

For flows, test the compiled spec directly before importing:
```python
import asyncio
from pathlib import Path
from tools.weather_flow import build_weather_flow

async def main():
    fdef = await build_weather_flow().compile_deploy()
    fdef.dump_spec(f"{Path(__file__).parent}/generated/weather_flow.json")
    await fdef.invoke({"city": "Paris"}, debug=True)   # debug=True prints node I/O

if __name__ == "__main__":
    asyncio.run(main())
```
`debug=True` surfaces each node's input/output so you can pinpoint a bad
`map_input`/`map_output` expression.

---

## 6. Pre-publish checklist

- [ ] All tools have `@tool` + valid Google-style docstrings + type hints.
- [ ] All flows use `build_<name>(aflow: Flow) -> Flow`, one per file.
- [ ] Agent YAML has `spec_version`, `kind: native`, `name`, `description`,
      `instructions`, `llm`, `style`, `tools`.
- [ ] Every referenced tool/KB/collaborator/connection/model is imported first.
- [ ] No secrets in YAML or code; credentials via `connections set-credentials`.
- [ ] `starter_prompts` + `welcome_content` set for good UX.
- [ ] Post-deploy verification gate (§1a) run: 1 single-turn + 1 multi-turn pass, `TEST_REPORT.md` produced — or the human explicitly declined testing.
- [ ] Definitions exported to Git; `import-all.sh` reproduces the build cleanly.
- [ ] Verified in the **production** env after `env activate`; agent `deploy`d.
