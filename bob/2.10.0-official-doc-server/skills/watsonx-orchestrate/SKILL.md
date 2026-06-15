---
name: watsonx-orchestrate
description: >-
  Build, import, test, debug, and publish IBM watsonx Orchestrate agents, tools, flows, toolkits (MCP), connections, models, and knowledge bases using the watsonx Orchestrate Agent Development Kit (ADK) and the `orchestrate` CLI.
  Use this whenever the user mentions watsonx Orchestrate, wxO, the orchestrate CLI, the ADK, `ibm-watsonx-orchestrate`, native/external/assistant agents, agent YAML, the `@tool` / `@flow` decorators, the Developer Edition, or wants to create / import / chat-test / deploy a wxO agent or tool.
metadata:
  enabled: true
---

Authoritative, end-to-end guide for delivering production agents on IBM watsonx Orchestrate with the Agent Development Kit (ADK). It is grounded in the real ADK source and CLI (pip installable) `ibm-watsonx-orchestrate` which contains the command `orchestrate`), not guesswork.


# 1. How to use this Skill, the Documentation MCP server and the orchestrate CLI

## Skill

This skill covers typical instructions how to get started with building agents on watsonx Orchestrate.

## MCP Documentation Server

Rather than guessing, utilize the MCP Documentation server! Do not rely on the data in the pre-trained model. MCP Server: 'watsonx-orchestrate-documentation' and the tools: 'search_ibm_watsonx_orchestrate_adk' and 'query_docs'.

*search_ibm_watsonx_orchestrate_adk*

Search across the IBM watsonx Orchestrate ADK knowledge base to find relevant information, code examples, API references, and guides. 

*query_docs_filesystem_ibm_watsonx_orchestrate_adk*

Read content from pages identified by the 'search_ibm_watsonx_orchestrate_adk' tool. This is a read-only shell-like interface to a virtualized filesystem containing only IBM watsonx Orchestrate documentation. 

Workflow: Start with the search tool for broad or conceptual queries like "how to authenticate" or "rate limiting". Use this tool when you need exact keyword/regex matching, structural exploration, or to read the full content of a specific page by path.

## orchestrate CLI

To access the watsonx Orchestrate environment, use the `orchestrate` CLI. Syntax: `orchestrate <group> <cmd>`. Top-level groups:
`env`, `agents`, `tools`, `toolkits`, `knowledge-bases`, `connections`,`models`, `server`, `chat`, `channels`, `settings`, `evaluations`, `observability`, `voice-configs`, `phone`, `partners`, `workspaces`.

See **[references/cli-reference-deployment.md](references/cli-reference-deployment.md)** for details on the following groups: `agents`, `tools`, `toolkits`, `knowledge-bases`, `connections`, `models`.

See **[references/cli-reference-testing.md](references/cli-reference-testing.md)** for details on the following groups: `chat`, `evaluations`, `observability`.

See **[references/cli-reference-configuration.md](references/cli-reference-configuration.md)** for details on the following groups: `env`, `server`, `channels`, `settings`, `voice-configs`, `phone`, `partners`, `workspaces`.

The watsonx Orchestrate Developer Edition is installed locally and configured. No further credentials are required.

**Bootstrap an isolated virtual environment + CLI** (idempotent — reuse an existing venv if present):
Python 3.11–3.13 (`<3.14`). Use the highest installed version in that range — **not** a bare `python3`, which may be the system 3.9 and will fail the ADK install.

```bash
# 1) Isolated Python env (reuse venv/ or .venv/ if it already exists)
for PY in python3.13 python3.12 python3.11; do command -v "$PY" >/dev/null && break; done
[ -d venv ] || [ -d .venv ] || "$PY" -m venv venv          # ADK needs Python 3.11–3.13
source venv/bin/activate 2>/dev/null || source .venv/bin/activate

# 2) Install the CLI if missing. 
orchestrate --version 2>/dev/null || pip install --upgrade "ibm-watsonx-orchestrate==2.10.0"
```
> Each new shell needs `source …/activate` (or call the venv's binaries directly).

### CLI Execution Guidelines

When executing commands via the CLI, agents must adhere to the following best practices:

* **Bypassing Confirmations**: Many commands (such as delete or reset operations) will prompt for confirmation. Use the `--yes` or `-y` flags (where available) to bypass these prompts. Alternatively, pipe the response: `echo "y" | orchestrate ...`.
* **Safe Mode**: Some commands accept a `--safe` flag, which prompts before updating existing resources. In fully automated environments, avoid using `--safe` unless interactive user intervention is desired.
* **JSON Output**: For parsing command results programmatically, specify the `-v` / `--verbose` or `--format json` option flags where available. Avoid parsing rich terminal tables unless JSON is unavailable.
* **Rich Output**: The CLI uses `rich` formatting. Avoid relying on regex matches against ANSI styling or colors. Use `PAGER=cat` or disable coloring/styling environments if standard stdout parsing is required.
* **`--debug`**: Enable python traceback printing (sets `tracebacklimit` to 40 instead of 0).
* **`--help`**: Print contextual subcommands and instructions.


# 2. Mental Model — what you are building

watsonx Orchestrate runs **agents** that route user requests to **tools**, **collaborator agents**, and **knowledge bases**, powered by an **LLM**.

| Resource | What it is | Defined as |
|----------|------------|------------|
| **Agent** | An LLM-driven assistant. Kinds: `native` (built here), `external` (A2A / external chat), `assistant` (watsonx Assistant) | YAML (`kind: native`) or Python `Agent` |
| **Tool** | A capability the agent can call | Python `@tool`, OpenAPI spec, Flow, or Langflow |
| **Flow** | A multi-step orchestrated workflow exposed as a tool | Python `@flow` (`build_<name>(aflow: Flow) -> Flow`) |
| **Toolkit** | A bundle of tools from an MCP server | `orchestrate toolkits add -k mcp …` |
| **Connection** | Stored credentials/config for an external service | YAML (`kind: connection`) + `connections` CLI |
| **Model** | An LLM made available to agents (e.g. watsonx.ai, Groq) | YAML (`kind: model`) via the AI Gateway |
| **Knowledge base** | Documents for RAG/grounding | YAML (`kind: knowledge_base`) |


# 3. The canonical Lifecycle

Follow this order. Dependencies must exist *before* the thing that references them.

```
scaffold project → Bootstrap an isolated virtual environment + CLI
   → write tools (+connections/models/KB) → write agent YAML
   → import connections → import models → import KB → import tools/toolkits
   → import agent → chat-test → debug → re-import → deploy
```

## Scaffold

```
my_project/
├── README.md
├── agents/            *.yaml
├── tools/             *.py  (one @flow per file; @tool can be grouped)
├── connections/       *.yaml (kind: connection)
├── knowledge_base/    *.yaml + source docs
├── models/            *.yaml (kind: model) — only if adding a custom model
├── import-all.sh      orchestrate ... import commands, dependency-ordered
├── delete-all.sh      deletes (un-deploys) all imported assets (un-deploys)
├── documents/         temporary markdown documents created by tools like Bob
└── .env               secrets (gitignored)
```

Do not import single assets, e.g. only the tool. Define all assets in import-all.sh and run the script. Delete all Orchestrate from this repo in delete-all.sh and invoke delete-all.sh from import-all.sh at the beginning.

## Import (dependency-ordered)

```bash
orchestrate env activate local

# 1) connections first (tools/agents reference them)
orchestrate connections import -f connections/my_api.yaml

# 2) custom models (if any)
orchestrate models import -f models/granite.yaml --app-id watsonx_credentials

# 3) knowledge bases
orchestrate knowledge-bases import -f knowledge_base/kb.yaml

# 4) tools — link credentials with --app-id; python tools take -r
orchestrate tools import -k python -f tools/weather.py -r tools/requirements.txt
orchestrate tools import -k python -f tools/api_tool.py --app-id my_api

# 4b) MCP toolkits — group is `toolkits` (plural)
orchestrate toolkits add -k mcp -n my_toolkit --description "My MCP tools" \
  --package-root ./mcp_server --language node \
  --command '["node","dist/index.js","--transport","stdio"]' --tools "*"

# 5) the agents last
orchestrate agents import -f agents/weather_agent.yaml
```

## Test

```bash
orchestrate agents list                                 # confirm it imported; see real `name`s
orchestrate agents list -v                              # full JSON incl. ids
orchestrate chat ask -n weather_agent "Weather in Paris?" -r   # non-interactive, -r shows reasoning
```

**Reference agents/tools by their `name` (snake_case), never the display name.**
e.g. an agent shown as "FM - Aegis" may have `name: FM_3009a0` — `-n "FM - Aegis"` will fail. Find the real `name` with `agents list -v`, or export it:
`orchestrate agents export -n <name> --kind native -o agent.yaml --agent-only`.

### Verify before handover (post-deploy gate)

**Deployed ≠ verified.** Never report an agent as "done" or "ready for handover" until it has been tested — or the human explicitly declined. After import (deploy), always run tests first. Run one single turn and one multi-turn test. Derive the tests from the agent's own spec (`description`, `instructions`, `tools`, and especially `starter_prompts` — those *are* example user prompts). You have to use two different prompts, one for single turn and another one for multi-turn.

```bash
# Single turn
./.bob/skills/watsonx-orchestrate/references/wxo-chat.sh -n <agent> "<prompt_1>"
# → { "thread_id": "3f92692d-...", "final_message": "...", ... }

# Multi turn - turn 1: new conversation
./.bob/skills/watsonx-orchestrate/references/wxo-chat.sh -n <agent> "<prompt_2>"
# → { "thread_id": "3f95692e-...", "final_message": "...", ... }

# multi turn - turn 2: resume (process can exit between turns)
./.bob/skills/watsonx-orchestrate/references/wxo-chat.sh -n <agent> --thread-id <thread-id> -r "<prompt_2_follow_up>"
# → { "thread_id": "3f95692e-...", "final_message": "...", "reasoning_trace": {"steps": [...]}, ... }
```

**Pass = behavior, not exact text** (LLMs are non-deterministic): no error, on-topic, the **expected tool was called** (visible via `-r`; `-l` for custom agents), and the multi-turn follow-up **uses prior context**. Then emit a short `documents/TEST_REPORT.md` (prompts, response excerpts, tool-call evidence, env, timestamp, pass/fail) and **report status honestly**: "deployed and tested (2/2)", "deployed; test 2 failed — …", or "deployed; not tested at your request".

# 4. Critical Constraints

- List what the active environment offers: orchestrate models list.
- Reference models in agent YAML by their full id, e.g. watsonx/meta-llama/llama-3-3-70b-instruct or a gateway provider like groq/openai/gpt-oss-120b.