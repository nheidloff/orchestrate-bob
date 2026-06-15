# Agent Management (`orchestrate agents`)
Deploy, import, copy, and manage agents in the active environment.

* **`list`**: List all agents.
  * *Options*:
    * `-k`, `--kind` (str): Filter by kind (`native`, `external`, `assistant`).
    * `-v`, `--verbose` (bool): Detailed JSON output.
  * *Usage*: `orchestrate agents list --kind native --verbose`
* **`import`**: Import an agent definition file.
  * *Options*:
    * `-f`, `--file` (str): YAML spec file path.
    * `--app-id` (str): Connection ID for external agent authentication.
    * `--safe` (bool): Prompt before overwriting existing agents.
  * *Usage*: `orchestrate agents import --file agent.yaml`
* **`create`**: Generate and publish a new agent.
  * *Options*:
    * `-n`, `--name` (str): Agent name (required for non-custom style).
    * `--description` (str): Agent description (required for non-custom style).
    * `-f`, `--file` (str): YAML/ZIP code path.
    * `-t`, `--title` (str): Title (external/assistant agents).
    * `-k`, `--kind` (str): Kind (`native`, `external`, `assistant`).
    * `--instructions` (str): Execution instructions for the agent.
    * `-a`, `--api` (str): API URL (external agents).
    * `--auth-scheme` (str): Authentication scheme (external agents).
    * `-p`, `--provider` (str): Agent provider (`external_chat`).
    * `--auth-config` (json): JSON string of auth config.
    * `--tools` (str): Repeated tool names (`--tools tool1 --tools tool2`).
    * `--knowledge-bases` (str): Repeated knowledge base names.
    * `--collaborators` (str): Repeated collaborator agent names.
    * `--style` (str): Agent style (`default`, `custom`, `planner`).
    * `--llm` (str): Selected LLM.
    * `-o`, `--output` (str): Path to write spec file out to (instead of publishing).
    * `-v`, `--context-variable` (str): Repeated context variable names.
    * `--safe` (bool): Prompt before updating.
  * *Usage*: `orchestrate agents create --name helper_agent --description "A helper agent" --kind native --tools calc_tool`
* **`remove`**: Remove an agent.
  * *Options*:
    * `-n`, `--name` (str, required): Agent name.
    * `-k`, `--kind` (str, required): Agent kind (`native`, `external`, `assistant`).
  * *Usage*: `orchestrate agents remove --name helper_agent --kind native`
* **`export`**: Export agent specs and dependencies.
  * *Options*:
    * `-n`, `--name` (str, required): Agent name.
    * `-k`, `--kind` (str, required): Agent kind.
    * `-o`, `--output` (str, required): Target ZIP or YAML path.
    * `--agent-only` (bool): Export only the YAML representation without dependencies.
  * *Usage*: `orchestrate agents export --name helper_agent --kind native --output helper.zip`
* **`deploy` / `undeploy`**: Promote or demote an agent to/from the live environment.
  * *Options*:
    * `-n`, `--name` (str, required): Agent name.
  * *Usage*: `orchestrate agents deploy --name helper_agent`
* **`copy`**: Copy agent to another workspace.
  * *Options*:
    * `-n`, `--name` (str, required): Agent name.
    * `-d`, `--destination` (str, required): Target workspace.
    * `-s`, `--source` (str): Source workspace.
  * *Usage*: `orchestrate agents copy --name helper_agent --destination "Production"`
* **`discover`**: Fetch and import an Agent-to-Agent (A2A) agent from a URL.
  * *Options*:
    * `-u`, `--url` (str, required): Base URL of A2A agent.
    * `-e`, `--endpoint` (str): Path to agent card json. Default: `.well-known/agent-card.json`.
    * `-n`, `--name` (str): Override agent name.
    * `-a`, `--app-id` (str): Connection ID for authentication.
  * *Usage*: `orchestrate agents discover --url https://agent.example.com`


# Python, OpenAPI, and Flow Tools (`orchestrate tools`)
* **`list`**: List tools in environment.
  * *Options*:
    * `-v`, `--verbose` (bool): Raw JSON list.
  * *Usage*: `orchestrate tools list --verbose`
* **`import`**: Import tool into environment.
  * *Options*:
    * `-k`, `--kind` (str, required): Format type (`python`, `openapi`, `flow`).
    * `-f`, `--file` (str): Path to spec or Python code.
    * `-a`, `--app-id` (str): Associated connection ID.
    * `-r`, `--requirements-file` (str): Python requirements file.
    * `-p`, `--package-root` (str): Package folder (multiple Python files).
    * `-n`, `--name` (str): Name of flow/tool.
    * `--auto-discover` (bool): Generate docstrings/decorations automatically.
    * `--save-flow-json` (str): Save compiled Flow JSON.
    * `--safe` (bool): Confirm before overwrite.
  * *Usage*: `orchestrate tools import --kind python --file calculator.py`
* **`remove`**: Remove tool.
  * *Options*:
    * `-n`, `--name` (str, required): Tool name.
  * *Usage*: `orchestrate tools remove --name calculator`
* **`export`**: Export tool to ZIP.
  * *Options*:
    * `-n`, `--name` (str, required): Tool name.
    * `-o`, `--output` (str, required): Target ZIP file path.
  * *Usage*: `orchestrate tools export --name calculator --output calculator.zip`
* **`auto-discover`**: Annotate and generate docstrings for python files without deploying them.
  * *Options*:
    * `-e`, `--env-file` (str, required): Environment file.
    * `-f`, `--file` (str, required): Input Python file.
    * `-o`, `--output` (str, required): Annotated output Python file.
  * *Usage*: `orchestrate tools auto-discover --env-file .env --file src.py --output annotated.py`


# Toolkits (`orchestrate toolkits`)
* **`list`**: List toolkits.
  * *Options*:
    * `-v`, `--verbose` (bool): JSON representation.
  * *Usage*: `orchestrate toolkits list`
* **`import`**: Import toolkit via MCP specification.
  * *Options*:
    * `-f`, `--file` (str, required): Path to MCP spec.
    * `-a`, `--app-id` (str): Associated connection IDs.
  * *Usage*: `orchestrate toolkits import --file mcp_spec.json`
* **`add`**: Create a toolkit from a remote or local package.
  * *Options*:
    * `-k`, `--kind` (str, required): toolkit kind (`mcp`).
    * `-n`, `--name` (str, required): Toolkit name.
    * `--description` (str, required): Description.
    * `--package` (str): NPM or Python package.
    * `--package-root` (str): Root directory of package.
    * `-l`, `--language` (str): `node` or `python`.
    * `--command` (str): Start command or JSON list arguments.
    * `-u`, `--url` (str): Remote URL.
    * `--transport` (str): Remote protocol (`sse`, `streamable_http`).
    * `-t`, `--tools` (str): Comma-separated list or `*`.
    * `-a`, `--app-id` (str): Repeated connection IDs.
  * *Usage*: `orchestrate toolkits add --kind mcp --name "SysToolkit" --description "OS Commands" --command "node index.js"`
* **`remove`**: Remove toolkit.
  * *Options*:
    * `-n`, `--name` (str, required): Toolkit name.
  * *Usage*: `orchestrate toolkits remove --name SysToolkit`
* **`export`**: Export toolkit spec.
  * *Options*:
    * `-n`, `--name` (str, required): Toolkit name.
    * `-o`, `--output` (str, required): Output file path (`.zip`).
  * *Usage*: `orchestrate toolkits export --name SysToolkit --output toolkit.zip`


# Knowledge Bases (`orchestrate knowledge-bases`)
Manage agent knowledge bases (built-in Milvus or external systems like Elastic/Milvus).

* **`list`**: List knowledge bases.
  * *Options*:
    * `-v`, `--verbose` (bool): Details in JSON format.
  * *Usage*: `orchestrate knowledge-bases list`
* **`import`**: Import/Upload a knowledge base definition.
  * *Options*:
    * `-f`, `--file` (str, required): Spec file path.
    * `-a`, `--app-id` (str): Connection ID for authentication.
    * `--safe` (bool): Safe mode prompt check.
  * *Usage*: `orchestrate knowledge-bases import --file kb_spec.yaml`
* **`status`**: Check indexing/processing status.
  * *Options*:
    * `-n`, `--name` (str): Search by name.
    * `-i`, `--id` (str): Search by ID.
  * *Usage*: `orchestrate knowledge-bases status --name my_kb`
* **`remove`**: Delete knowledge base.
  * *Options*:
    * `-n`, `--name` (str): Search by name.
    * `-i`, `--id` (str): Search by ID.
  * *Usage*: `orchestrate knowledge-bases remove --name my_kb`
* **`export`**: Save spec to YAML.
  * *Options*:
    * `-o`, `--output` (str, required): Export path.
    * `-n`, `--name` (str): Search by name.
    * `-i`, `--id` (str): Search by ID.
  * *Usage*: `orchestrate knowledge-bases export --name my_kb --output kb.yaml`


# Connections (`orchestrate connections`)
Manage environment authentication configurations, credentials, and SSO identity providers.

* **`list`**: List active connections.
  * *Options*:
    * `--env` (str): Filter by environment name (`draft`, `live`).
    * `-v`, `--verbose` (bool): Print raw JSON.
  * *Usage*: `orchestrate connections list --verbose`
* **`add`**: Create a connection placeholder.
  * *Options*:
    * `-a`, `--app-id` (str, required): Unique app ID reference.
    * `--component` (str): Associated component (e.g. `knowledge`, `registry`).
    * `--category` (str): Category (e.g. `milvus` for knowledge).
  * *Usage*: `orchestrate connections add --app-id my-db-conn`
* **`remove`**: Remove connection and credentials.
  * *Options*:
    * `-a`, `--app-id` (str, required): App ID.
  * *Usage*: `orchestrate connections remove --app-id my-db-conn`
* **`import` / `export`**: Import/export connection specs.
  * *Usage*: `orchestrate connections import --file conn.json`
* **`configure`**: Define authentication parameters.
  * *Options*:
    * `-a`, `--app-id` (str, required): Target connection app ID.
    * `--env` (str, required): Target environment.
    * `-t`, `--type` (str, required): `team` (shared) or `member` (user-specific).
    * `-k`, `--kind` (str, required): Authentication kind (`basic_auth`, `bearer_auth`, `api_key`, `oauth_auth_client_credentials_flow`, etc.).
    * `-u`, `--server-url` (str): Application endpoint URL.
    * `-s`, `--sso` (bool): Set True if SAML/SSO is required.
    * `-e`, `--config-entries` (str): Repeated key=value items.
  * *Usage*: `orchestrate connections configure --app-id my-db-conn --env draft --type team --kind basic_auth --server-url https://api.db.com`
* **`set-credentials`**: Configure credentials for a connection.
  * *Options*:
    * `-a`, `--app-id` (str, required): App ID.
    * `--env` (str, required): Environment.
    * `-u`, `--username` (str): Username.
    * `-p`, `--password` (str): Password.
    * `--token` (str): Bearer token.
    * `-k`, `--api-key` (str): API key.
    * `--client-id` (str): Client ID (OAuth).
    * `--client-secret` (str): Client Secret (OAuth).
    * `-e`, `--entries` (str): Repeated key=value entries.
  * *Usage*: `orchestrate connections set-credentials --app-id my-db-conn --env draft -u my_user -p my_pwd`
* **`set-identity-provider`**: Set up OIDC identity provider details.
  * *Options*:
    * `-a`, `--app-id`, `--env`, `-u` / `--url`, `--client-id`, `--client-secret`, `--scope`, `--grant-type`.
  * *Usage*: `orchestrate connections set-identity-provider --app-id my-oauth --env draft --url https://idp.com/oauth/token --client-id xxx --client-secret yyy --scope openid --grant-type client_credentials`


# LLM Management (`orchestrate models`)
Manage available Large Language Models (LLMs), routing policies, and configuration filters.

* **`list`**: List all models.
  * *Options*:
    * `-r`, `--raw` (bool): Print raw list without tables.
    * `-a`, `--all` (bool): Display all models.
  * *Usage*: `orchestrate models list --all`
* **`add`**: Declare a model from an external model provider.
  * *Options*:
    * `-n`, `--name` (str, required): Model name.
    * `-d`, `--description` (str): Description.
    * `--display-name` (str): UI Name.
    * `--provider-config` (json): Configuration settings string.
    * `-a`, `--app-id` (str): Credential connection ID.
    * `--type` (str): Model type (`chat`, `embedding`).
  * *Usage*: `orchestrate models add --name custom-llama --provider-config '{"url":"..."}' -a provider-conn`
* **`remove`**: Delete model provider details.
  * *Usage*: `orchestrate models remove --name custom-llama`
* **`export` / `import`**: Export or import model specifications.
  * *Usage*: `orchestrate models export --name custom-llama --output spec.yaml`

## Model Configuration (`orchestrate models config`)
* **`list`**: View tenant-level configuration.
* **`reset`**: Clear tenant model selection overrides.
* **`export` / `import`**: Backup or restore configuration specs.
* **`default`**: Set tenant-wide default model.
  * *Options*: `--name` (str, required).
  * *Usage*: `orchestrate models config default --name groq/openai/gpt-oss-120b`
* **`denylist add` / `denylist remove`**: Manage blocked models.
  * *Options*: `--name` (str, required).
  * *Usage*: `orchestrate models config denylist add --name watsonx/mistral-large`

## Routing Policies (`orchestrate models policy`)
Combine multiple models behind a virtual routing endpoint to distribute load or fallback on failures.

* **`add`**: Create a policy.
  * *Options*:
    * `-n`, `--name` (str, required): Policy identifier.
    * `-m`, `--model` (str): Repeated member model names.
    * `-s`, `--strategy` (str, required): Traffic pattern (`failover`, `priority`, etc.).
    * `--retry-attempts` (int): Number of connection retries.
    * `--strategy-on-code` (int): Repeated HTTP codes triggering routing.
    * `--retry-on-code` (int): Repeated HTTP codes triggering retries.
  * *Usage*: `orchestrate models policy add --name "LLamaGroup" -m modelA -m modelB --strategy failover`
* **`remove`**: Delete policy.
  * *Usage*: `orchestrate models policy remove --name "LLamaGroup"`