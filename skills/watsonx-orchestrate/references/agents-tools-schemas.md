# Agents, Tools & Flows — schemas and decorators

Grounded in the ADK source (`agent_builder/agents/types.py`,
`agent_builder/tools/python_tool.py`, `flow_builder`).

---

## 1. Agent YAML — `kind: native`

```yaml
spec_version: v1                 # REQUIRED
kind: native                     # REQUIRED
name: my_agent                   # REQUIRED — snake_case, no spaces
description: What this agent does and when to use it.   # REQUIRED (used for routing)
display_name: My Agent           # optional, UI label
instructions: |                  # the system prompt / behavior
  You are ... When the user ..., call <tool>. Be concise.
llm: watsonx/meta-llama/llama-3-3-70b-instruct   # defaults to tenant default if omitted
style: default                   # default | react | planner | custom | experimental_customer_care | react_intrinsic
hide_reasoning: false
tools:                           # by name; must be imported first
  - get_weather
collaborators:                   # other agents this one can delegate to (by name)
  - billing_agent
knowledge_base:                  # KB names for RAG
  - product_docs
toolkits: []                     # only for experimental_customer_care style
guidelines:                      # optional conditional behaviors
  - display_name: Escalate
    condition: user asks for a human
    action: hand off to billing_agent
    tool: billing_agent
structured_output:               # optional JSON schema to force structured replies
  type: object
  properties:
    answer: { type: string }
custom_join_tool: null           # planner style only (mutually exclusive w/ structured_output)
context_access_enabled: true
context_variables: []            # list of non-empty strings
memory_enabled: null             # agentic memory
starter_prompts:
  is_default_prompts: false
  prompts:
    - id: default0
      title: Short action title
      subtitle: optional
      prompt: Example clickable prompt
      state: active
welcome_content:
  is_default_message: false
  welcome_message: Welcome to My Agent
  description: One line on what it helps with
chat_with_docs:                  # optional: let users chat over uploaded docs
  enabled: true
icon: null
is_schedulable: null
```

**Validation rules from source**
- `kind` must equal `native` for a native agent (else `BadRequest`).
- An agent cannot list itself as a collaborator (circular reference).
- `planner` style: provide at most one of `custom_join_tool` / `structured_output`.
- `experimental_customer_care` style: expects `groq/openai/gpt-oss-120b`; does
  **not** support `tools`, `knowledge_base`, `plugins`, `guidelines`,
  `collaborators`, `custom_join_tool`, `chat_with_docs.enabled`.
- `toolkits` are rejected for non-customer-care styles (except the schedulable
  `scheduling_tools` exception).

### External agent (`kind: external`)
A2A / external chat agents. Key fields: `api_url` (required), `auth_scheme`
(`BEARER_TOKEN | API_KEY | NONE`), `auth_config`, `provider`
(`external_chat`, `external_chat/A2A/0.2.1`, `external_chat/A2A/0.3.0`,
`salesforce`, …), `nickname`, `app_id`/`connection_id`, `chat_params`,
`config.enable_cot`, `config.hidden`. Import with `orchestrate agents import -f … --app-id <conn>`.

### Assistant agent (`kind: assistant`)
Wraps a watsonx Assistant. `config` carries `assistant_id`, `crn`,
`service_instance_url`, `environment_id`, `auth_type`
(`MCSP | IBM_CLOUD_IAM | ICP_IAM | BEARER_TOKEN`), `api_key`, `authorization_url`,
`connection_id`; plus top-level `nickname`, `app_id`.

### Defining an agent in Python (alternative to YAML)
```python
from ibm_watsonx_orchestrate.agent_builder.agents import Agent
agent = Agent(
    name="my_agent",
    description="...",
    instructions="...",
    llm="watsonx/meta-llama/llama-3-3-70b-instruct",
    tools=[get_weather],          # PythonTool objects or names
)
agent.dump_spec("agents/my_agent.yaml")   # serialize for CLI import
```

---

## 2. Python tools — `@tool`

```python
from ibm_watsonx_orchestrate.agent_builder.tools import tool, ToolPermission
```

Decorator signature (all optional):
```python
@tool(
    name=...,                 # defaults to function name
    description=...,          # defaults to docstring summary (used for routing)
    permission=ToolPermission.READ_ONLY,   # READ_ONLY | WRITE_ONLY | READ_WRITE | ADMIN
    expected_credentials=[...],             # list[ExpectedCredentials]
    display_name=...,
    input_schema=..., output_schema=...,    # ToolRequestBody/ResponseBody (advanced)
    enable_dynamic_input_schema=False, enable_dynamic_output_schema=False,
    response_format=...,                     # 'content' | 'content_and_artifact'
)
```

### Google-style docstring (parser is strict)
```python
@tool(permission=ToolPermission.READ_WRITE)
def process_request(request_id: str, user_email: str, priority: str = "normal") -> dict:
    """
    Process a service request and create a ticket.

    Args:
        request_id (str): Unique identifier for the request.
        user_email (str): Email of the requesting user.
        priority (str): Priority level (default: normal).
    Returns:
        dict: Result with status and message.
    """
    ...
```
- Summary line, then `Args:`, then `Returns:` with **no blank line between the
  Args and Returns blocks**.
- Every param + return value needs a type hint that matches the docstring type.
- Missing type hints → the parser warns and defaults to `str`.

### Credentials at runtime (never as parameters)
```python
from ibm_watsonx_orchestrate.agent_builder.tools import tool, ToolPermission
from ibm_watsonx_orchestrate.agent_builder.connections import ConnectionType, ExpectedCredentials
from ibm_watsonx_orchestrate.run import connections

APP_ID = "my_api"

@tool(permission=ToolPermission.READ_ONLY,
      expected_credentials=[ExpectedCredentials(app_id=APP_ID, type=ConnectionType.API_KEY_AUTH)])
def call_api(query: str) -> dict:
    """Call the API.

    Args:
        query (str): Search text.
    Returns:
        dict: API response.
    """
    conn = connections.api_key_auth(APP_ID)     # fetch at runtime
    headers = {"Authorization": f"Bearer {conn.api_key}"}
    ...
```
Runtime accessors: `connections.api_key_auth(app_id).api_key`,
`connections.basic(app_id).username/.password`,
`connections.bearer_token(app_id).token`,
`connections.oauth2_auth_code(app_id).access_token`.

### Self-containment
Only stdlib, common third-party (`requests`, `pydantic`, …), and
`ibm_watsonx_orchestrate` imports. **No** `from .x import y` or
`from tools.shared import z`. Define every helper/Pydantic model in the same file.

### Pydantic schemas
Define as explicit classes — never `type('X',(BaseModel,),{...})` (causes
"non-annotated attribute" errors):
```python
from pydantic import BaseModel, Field
class Result(BaseModel):
    status: str = Field(description="Outcome status")
```

---

## 3. Flows — `@flow`

```python
from pydantic import BaseModel
from ibm_watsonx_orchestrate.flow_builder.flows import Flow, flow, START, END

class MyInput(BaseModel):
    city: str

@flow(name="weather_flow", display_name="Weather Flow",
      description="Fetch then format weather", input_schema=MyInput)
def build_weather_flow(aflow: Flow) -> Flow:        # signature is mandatory
    fetch = aflow.tool(get_weather)
    summarize = aflow.prompt(
        name="summarize",
        system_prompt="You format weather data for users.",   # REQUIRED
        user_prompt=["Summarize: {weather}"],
        llm="watsonx/meta-llama/llama-3-3-70b-instruct",
    )
    aflow.sequence(START, fetch, summarize, END)
    return aflow
```

**Node builders**: `aflow.tool(fn)`, `aflow.prompt(...)`, `aflow.user_activity(...)`,
`aflow.docproc(...)`, `aflow.script(...)`, `aflow.agent(...)`, `aflow.if_else(...)`,
`aflow.foreach(...)`. **Wiring**: `aflow.sequence(START, n1, n2, END)` or
`aflow.edge(a, b)`. **Data**: `node.map_input(...)`, `aflow.map_output(...)`.

Constraints:
- Function name starts with `build_`, param is `aflow: Flow`, returns `Flow`.
- One flow per file.
- `map_input`/`map_output` expressions are **single-line** Python (list
  comprehensions/inline logic only) — no defining or calling functions; flow-file
  functions are not available at runtime.
- `prompt` nodes require `system_prompt`.

Import a flow as a tool: `orchestrate tools import -k flow -f tools/weather_flow.py`.

### Document processing (docproc) — KVP extraction
Use `DocProcKVPSchema` + `DocProcField` (not plain dicts):
```python
from ibm_watsonx_orchestrate.flow_builder.types import (
    DocProcInput, DocProcKVPSchema, DocProcField, DocProcOutputFormat)

SCHEMA = DocProcKVPSchema(
    document_type="Invoice", document_description="A business invoice",
    additional_prompt_instructions="Extract values exactly as shown.",
    fields={"invoice_number": DocProcField(description="Invoice id", default="", example="INV-001")},
)

@flow(name="doc_flow", input_schema=DocProcInput)
def build_doc_flow(aflow: Flow) -> Flow:
    node = aflow.docproc(name="extract", task="text_extraction",
                         output_format=DocProcOutputFormat.object,
                         kvp_schemas=[SCHEMA], kvp_force_schema_name="Invoice")
    aflow.sequence(START, node, END)
    return aflow
```
With `output_format=object`, `kvps` is a **list** of objects shaped like
`{"key": {"semantic_label": "invoice_number"}, "value": {"raw_text": "INV-001"}}`.
To use values, either pass the whole `kvps` array to a `prompt` node to format,
or extract with a single-line list comprehension matching `semantic_label`.
**Agents cannot pass user-uploaded files to a flow** — the docproc node prompts
the user for the upload itself; agent instructions should just invoke the flow.

### Programmatic flow test
```python
import asyncio
from pathlib import Path
from tools.weather_flow import build_weather_flow

async def main():
    fdef = await build_weather_flow().compile_deploy()
    fdef.dump_spec(f"{Path(__file__).parent}/generated/weather_flow.json")
    await fdef.invoke({"city": "Paris"}, debug=True)

asyncio.run(main())
```
Run with `PYTHONPATH` pointing at the ADK `src` if importing ADK internals.
