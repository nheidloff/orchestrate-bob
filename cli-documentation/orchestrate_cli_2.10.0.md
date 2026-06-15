# Watsonx Orchestrate CLI: Agentic Reference Manual

This document provides a comprehensive command reference and operational guide for the `orchestrate` CLI. It is structured specifically for AI Agents (such as IBM Bob, Antigravity, Claude Code, etc.) to query, understand, and execute commands efficiently in headless or automation contexts.

---

## 1. Agentic Design & Execution Guidelines

When executing commands via the CLI, agents must adhere to the following best practices:

### Headless & Non-Interactive Execution
* **Bypassing Confirmations**: Many commands (such as delete or reset operations) will prompt for confirmation. Use the `--yes` or `-y` flags (where available) to bypass these prompts. Alternatively, pipe the response: `echo "y" | orchestrate ...`.
* **Safe Mode**: Some commands accept a `--safe` flag, which prompts before updating existing resources. In fully automated environments, avoid using `--safe` unless interactive user intervention is desired.

### Machine-Readable Output Formats
* **JSON Output**: For parsing command results programmatically, specify the `-v` / `--verbose` or `--format json` option flags where available. Avoid parsing rich terminal tables unless JSON is unavailable.
* **Rich Output**: The CLI uses `rich` formatting. Avoid relying on regex matches against ANSI styling or colors. Use `PAGER=cat` or disable coloring/styling environments if standard stdout parsing is required.

### Context & Environment Setup
* **Active Environment**: The active environment context is stored globally in `~/.config/orchestrate/config.yaml`.
* **Prerequisite**: Agents **MUST** execute `orchestrate env activate <env_name>` before running any commands that interact with the active environment.
* **IBM Cloud Environments**: The `orchestrate workspaces` command group is only loaded and accessible when connected to IBM Cloud environments (as determined by the active environment authentication type).

---

## 2. Command Reference

### 2.1. Environment Management (`orchestrate env`)
Configure, list, and activate environments (local server or production instances).

* **`list`**: List all defined environments.
  * *Usage*: `orchestrate env list`
* **`add`**: Define a new environment.
  * *Options*:
    * `-n`, `--name` (str, required): Name of the environment.
    * `-u`, `--url` (str, required): URL of the Watsonx Orchestrate instance.
    * `-a`, `--activate` (bool): Activate the environment immediately.
    * `-t`, `--type` (str): Override inferred authentication type.
    * `--insecure` (bool): Ignore SSL validation errors (CPD only).
    * `--verify` (str): Path to SSL Cert bundle (CPD only).
  * *Usage*: `orchestrate env add --name dev --url https://example.com --activate`
* **`activate`**: Set an environment as active for all subsequent commands.
  * *Arguments*: `name` (str, required)
  * *Options*:
    * `-a`, `--api-key` (str): API key for WXO or CPD.
    * `-u`, `--username` (str): Username (CPD only).
    * `-p`, `--password` (str): Password (CPD only).
    * `--skip-version-check`: Skip checking if the local ADK version exists on PyPI.
  * *Usage*: `orchestrate env activate dev --api-key MY_API_KEY`
* **`remove`**: Remove an environment definition.
  * *Options*:
    * `-n`, `--name` (str, required): Name of the environment.
  * *Usage*: `orchestrate env remove --name dev`

---

### 2.2. Workspace Management (`orchestrate workspaces`)
Manage workspaces and workspace members. *Only available for IBM Cloud environments.*

* **`list`**: List workspaces.
  * *Options*:
    * `-v`, `--verbose` (bool): Print raw JSON.
  * *Usage*: `orchestrate workspaces list --verbose`
* **`create`**: Create or update a workspace.
  * *Options*:
    * `-n`, `--name` (str, required): Workspace name (must be unique).
    * `-d`, `--description` (str): Description.
  * *Usage*: `orchestrate workspaces create --name "HR Team" --description "HR Agents"`
* **`remove`**: Delete a workspace.
  * *Options*:
    * `-n`, `--name` (str, required): Workspace name.
    * `--delete-artifacts` (bool): Delete all artifacts.
    * `--keep-artifacts` (bool): Move artifacts to the global workspace.
  * *Usage*: `orchestrate workspaces remove --name "HR Team" --delete-artifacts`
* **`activate`**: Set a workspace as active.
  * *Arguments*: `name` (str, required)
  * *Usage*: `orchestrate workspaces activate "HR Team"`
* **`deactivate`**: Reset active workspace back to global.
  * *Usage*: `orchestrate workspaces deactivate`
* **`export`**: Export all workspace resources.
  * *Options*:
    * `-n`, `--name` (str): Workspace name (defaults to active workspace).
    * `-o`, `--output` (str): Target ZIP path. Default: `workspace_export.zip`.
  * *Usage*: `orchestrate workspaces export --output ./hr_workspace.zip`

#### Workspace Members (`orchestrate workspaces members`)
* **`add`**: Add or update member roles.
  * *Options*:
    * `-u`, `--user` (str, required): User email.
    * `-r`, `--role` (str, required): Role (`owner` or `editor`).
    * `-n`, `--name` (str): Workspace name.
  * *Usage*: `orchestrate workspaces members add --user user@ibm.com --role editor`
* **`list`**: List members.
  * *Options*:
    * `-n`, `--name` (str): Workspace name.
    * `-v`, `--verbose` (bool): JSON output.
  * *Usage*: `orchestrate workspaces members list`
* **`remove`**: Remove member.
  * *Options*:
    * `-u`, `--user` (str, required): User email to remove.
    * `-n`, `--name` (str): Workspace name.
  * *Usage*: `orchestrate workspaces members remove --user user@ibm.com`

---

### 2.3. Agent Management (`orchestrate agents`)
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

#### AI Builder (`orchestrate agents ai-builder`)
Leverage AI capabilities to design and optimize agents.

* **`create`**: Converse with the AI Builder to construct a new agent.
  * *Options*:
    * `-o`, `--output-file` (str): Output YAML path.
    * `-d`, `--agent_description` (str): Initial description.
    * `--chat-llm` (str): AI Builder's model choice.
    * `--llm` (str): Model for the generated agent.
    * `--dry-run` (bool): Print spec to console without saving.
  * *Usage*: `orchestrate agents ai-builder create --agent_description "Process invoice files" --dry-run`
* **`prompt-tune`**: Improve agent performance using Conversational Prompt Engineering (CPE).
  * *Options*:
    * `-f`, `--file` (str, required): Path to agent spec file.
    * `-o`, `--output-file` (str): Saved tuned output spec.
    * `--dry-run` (bool): Print tuned content to stdout.
  * *Usage*: `orchestrate agents ai-builder prompt-tune --file agent.yaml --dry-run`
* **`autotune`**: Tune instructions based on historical chats.
  * *Options*:
    * `-n`, `--name` (str, required): Agent name.
    * `-o`, `--output-file` (str): Tuned output path.
    * `-l`, `--use-last-chat` (bool): Tune using only the last chat session.
    * `--dry-run` (bool): Output target spec to stdout.
  * *Usage*: `orchestrate agents ai-builder autotune --agent-name helper_agent --use-last-chat`

---

### 2.4. Tool & Toolkit Management

#### Python, OpenAPI, and Flow Tools (`orchestrate tools`)
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

#### Toolkits (`orchestrate toolkits`)
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

---

### 2.5. Knowledge Bases (`orchestrate knowledge-bases`)
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

---

### 2.6. Connections (`orchestrate connections`)
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

---

### 2.7. Local Server Management (`orchestrate server`)
Control the local Developer Edition virtual machine (Lima on macOS, WSL on Windows) and its containers.

* **`start`**: Launch the local server and services.
  * *Options*:
    * `-e`, `--env-file` (str): Custom `.env` overrides.
    * `--accept-terms-and-conditions` (bool): **Required for headless start to bypass license terms**.
    * `-l`, `--with-langfuse` (bool): Enable local Langfuse tracing UI.
    * `-d`, `--with-doc-processing` (bool): Enable Milvus + document parsing (requires 24GB memory).
    * `-c`, `--with-connections-ui` (bool): Enable Connections UI manager.
    * `--with-langflow` (bool): Enable Langflow container (http://localhost:7861).
    * `--with-ai-builder` (bool): Enable AI builder interface.
    * `--sequential-pull` (bool): Pull container images sequentially.
    * `-f`, `--compose-file` (str): Use custom docker-compose file.
  * *Usage*: `orchestrate server start --accept-terms-and-conditions --with-langflow`
* **`stop`**: Stop server and shut down VM.
  * *Options*:
    * `-e`, `--env-file` (str): Overriding `.env` path.
    * `--keep-vm` (bool): Stop containers but leave VM running.
  * *Usage*: `orchestrate server stop`
* **`reset`**: Stop services and delete named volumes (wipes database).
  * *Usage*: `orchestrate server reset`
* **`purge`**: Completely delete the virtual machine instance and associated cached data.
  * *Usage*: `orchestrate server purge`
* **`edit`**: Adjust VM CPU and memory.
  * *Options*:
    * `--cpus` (int): CPU core limit.
    * `--memory` (int): Memory size in GB.
    * `--disk` (int): Disk space in GB.
  * *Usage*: `orchestrate server edit --cpus 4 --memory 16`
* **`logs`**: Tail container log output.
  * *Options*:
    * `-i`, `--id` (str): Focus on container ID.
    * `-n`, `--name` (str): Focus on container Name (e.g. `wxo-server`).
    * `-e`, `--env-file` (str): Context `.env` file.
  * *Usage*: `orchestrate server logs --name wxo-server`
* **`ssh`**: SSH directly into the running VM (Lima/WSL).
  * *Usage*: `orchestrate server ssh`
* **`attach-docker` / `release-docker`**: Route default `docker` CLI commands directly to the WXO VM docker context.
  * *Usage*: `orchestrate server attach-docker`
* **`images prune`**: Clean the CPD registry container image cache.
  * *Options*:
    * `-a`, `--all` (bool): Clear all cached layers.
    * `-e`, `--env-file` (str): Environment file containing registry credentials.
  * *Usage*: `orchestrate server images prune --all`
* **`eject`**: Output the internal Docker compose configuration and merged environment parameters to working directory.
  * *Usage*: `orchestrate server eject -e .env`

---

### 2.8. Interaction & Testing (`orchestrate chat`)
Launch the Web Chat UI or conduct text-based chat tests.

* **`start`**: Run the chat interface service (hosted at `http://localhost:3000/chat-lite`).
  * *Options*:
    * `-e`, `--env-file` (str): Override settings.
    * `--skip-open` (bool): Avoid opening chat UI automatically in web browser.
  * *Usage*: `orchestrate chat start --skip-open`
* **`stop`**: Stop the chat interface service.
  * *Usage*: `orchestrate chat stop`
* **`ask`**: Chat with an agent in interactive console mode or send a single prompt.
  * *Arguments*: `message` (str): Single message to evaluate (optional).
  * *Options*:
    * `-n`, `--agent-name` (str, required): Target agent name.
    * `-r`, `--include-reasoning` (bool): Display execution thoughts/agent reasoning.
    * `-l`, `--capture-logs` (bool): Print container logs inline (custom agents only).
    * `-t`, `--thread-id` (str): Resume conversation thread.
  * *Usage*: `orchestrate chat ask --agent-name calc_agent "What is 2 + 2?" --include-reasoning`

---

### 2.9. LLM Management (`orchestrate models`)
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

#### Model Configuration (`orchestrate models config`)
* **`list`**: View tenant-level configuration.
* **`reset`**: Clear tenant model selection overrides.
* **`export` / `import`**: Backup or restore configuration specs.
* **`default`**: Set tenant-wide default model.
  * *Options*: `--name` (str, required).
  * *Usage*: `orchestrate models config default --name watsonx/meta-llama/llama-3-3-70b-instruct`
* **`denylist add` / `denylist remove`**: Manage blocked models.
  * *Options*: `--name` (str, required).
  * *Usage*: `orchestrate models config denylist add --name watsonx/mistral-large`

#### Routing Policies (`orchestrate models policy`)
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

---

### 2.10. Integration Channels (`orchestrate channels` & `orchestrate phone`)

#### Channels (`orchestrate channels`)
Link agents to custom endpoints like WhatsApp, Twilio, or web chats.

* **`list`**: List all supported channel formats.
* **`list-channels`**: List configured channel instances.
  * *Options*: `--agent-name` (required), `--env` (required, `draft` or `live`), `--type` (filter), `--verbose`, `--format`.
  * *Usage*: `orchestrate channels list-channels --agent-name helper_agent --env draft`
* **`create`**: Add an active channel instance.
  * *Options*:
    * `--agent-name` (str, required), `--env` (str, required), `--type` (str, required), `--name` (str, required).
    * `-f`, `--field` (str): Repeated configuration fields.
  * *Usage*: `orchestrate channels create --agent-name helper_agent --env draft --type twilio_whatsapp --name my-wa --field account_sid=ACxxx --field twilio_authentication_token=yyy`
* **`get`**: Retrieve channel configuration details.
  * *Usage*: `orchestrate channels get --agent-name helper_agent --env draft --type twilio_whatsapp --name my-wa --verbose`
* **`export` / `import`**: Backup or restore channel configurations.
  * *Usage*: `orchestrate channels export --agent-name helper_agent --env draft --type twilio_whatsapp --name my-wa --output ch.yaml`
* **`delete`**: Remove channel instance.
  * *Options*: `--yes` / `-y` to skip confirmation.
  * *Usage*: `orchestrate channels delete --agent-name helper_agent --env draft --type twilio_whatsapp --name my-wa --yes`
* **`webchat embed`**: Generate HTML embedding tags.
  * *Usage*: `orchestrate channels webchat embed --agent-name helper_agent --env live`

#### Phone Integrations (`orchestrate phone`)
* **`list`**: List phone channels.
* **`create`**: Establish a phone channel configuration.
  * *Options*: `--name`, `--type`, `--description`, `--field`, `--output`.
  * *Usage*: `orchestrate phone create --name "SIP Trunk" --type sip_trunk --field server_address=sip.test.com`
* **`list-configs`**: View defined configurations.
* **`get` / `delete`**: Retrieve or remove configuration specifications.
  * *Usage*: `orchestrate phone delete --name "SIP Trunk" --yes`
* **`import` / `export`**: Backup or restore configs.
* **`attach` / `detach`**: Add or remove agent environment bindings.
  * *Options*: `--name` (config), `--agent-name`, `--env`.
  * *Usage*: `orchestrate phone attach --name "SIP Trunk" --agent-name helper_agent --env draft`
* **`list-attachments`**: List all agents linked to configuration.
* **`add-number` / `delete-number` / `update-number` / `list-numbers`**: Manage target phone numbers (SIP configurations only).
  * *Usage*: `orchestrate phone add-number --name "SIP Trunk" --number +15551234567 --agent-name helper_agent --env draft`

---

### 2.11. Observability Traces (`orchestrate observability`)
Search and download execution traces. Useful for debugging tool actions.

* **`traces search`**: Locate trace IDs matching criteria.
  * *Options*:
    * `--start-time` / `--end-time` (ISO 8601 strings).
    * `--last` (str): Time window shorthand (`30m`, `3h`, `10d`, `30 minutes`, etc.). *Mutually exclusive with start/end parameters.*
    * `-s`, `--service-name` (str): Repeated service names.
    * `-i`, `--agent-id` (str): Repeated agent IDs.
    * `-a`, `--agent-name` (str): Repeated agent names.
    * `-u`, `--user-id` (str): Repeated user IDs.
    * `--limit` (int): Number of trace logs. Max 1000.
  * *Usage*: `orchestrate observability traces search --last 3h --agent-name helper_agent`
* **`traces export`**: Retrieve span records for a trace.
  * *Options*:
    * `-t`, `--trace-id` (str, required): 32-character hexadecimal trace ID.
    * `-o`, `--output` (str): Save JSON output directly to file path.
    * `--pretty/--no-pretty` (bool): Formatted print.
  * *Usage*: `orchestrate observability traces export --trace-id 1234567890abcdef1234567890abcdef --output trace.json`

---

### 2.12. Agent Evaluation (`orchestrate evaluations`)
Run tests, generate test configurations, or execute red-teaming checks.

* **`evaluate`**: Execute test suits.
  * *Options*:
    * `-c`, `--config` (str): Path to configuration YAML.
    * `-p`, `--test-paths` (str): Comma-separated paths to test files/folders.
    * `-o`, `--output-dir` (str): Target results output folder.
    * `-e`, `--env-file` (str): Overriding `.env` path.
    * `-l`, `--with-langfuse` (bool): Save trace details to Langfuse.
  * *Usage*: `orchestrate evaluations evaluate --test-paths ./tests --output-dir ./results`
* **`quick-eval`**: Evaluate metrics referenceless (LLM-as-a-judge).
  * *Options*: `--test-paths`, `--tools-path`, `--output-dir`, `--config`.
  * *Usage*: `orchestrate evaluations quick-eval --test-paths ./tests --tools-path ./tools --output-dir ./results`
* **`record`**: Record live chat sessions to automatically construct evaluation tests.
  * *Usage*: `orchestrate evaluations record --output-dir ./new_tests`
* **`generate`**: Create test cases from user stories.
  * *Options*: `--stories-path` (CSV), `--tools-path` (directory), `--output-dir`.
  * *Usage*: `orchestrate evaluations generate --stories-path stories.csv --tools-path ./tools --output-dir ./tests`
* **`analyze`**: Read and analyze test results.
  * *Options*: `--data-path` (directory containing results), `--tools-path`, `--mode` (`default` or `enhanced`).
  * *Usage*: `orchestrate evaluations analyze --data-path ./results`
* **`validate-external`**: Validate schema specifications and perform integration checks for an external agent.
  * *Options*: `--tsv`, `--external-agent-config`, `--credential`, `--output`, `--perf`.
  * *Usage*: `orchestrate evaluations validate-external --tsv inputs.tsv --external-agent-config agent.json --credential token123 --output ./validation`
* **`validate-native`**: Evaluate native agent outputs.
  * *Usage*: `orchestrate evaluations validate-native --tsv inputs.tsv --output ./validation`

#### Red-Teaming Attacks (`orchestrate evaluations red-teaming`)
* **`list`**: List all available red-teaming attack plans.
* **`plan`**: Create attack scenarios against an agent.
  * *Options*: `--attacks-list`, `--datasets-path`, `--agents-path`, `--target-agent-name`, `--output-dir`, `--max_variants`.
  * *Usage*: `orchestrate evaluations red-teaming plan -a prompt_injection -d dataset.json -g ./agents -t helper_agent -o ./attacks`
* **`run`**: Execute red-teaming plans.
  * *Options*: `--attack-paths` (comma-separated), `--output-dir`.
  * *Usage*: `orchestrate evaluations red-teaming run --attack-paths ./attacks -o ./attack_results`

---

### 2.13. Other System Settings (`orchestrate settings` & `orchestrate partners`)

#### System Settings (`orchestrate settings`)
* **`set-encoding` / `unset-encoding`**: Set the global file encoding system or revert to automatic detection.
  * *Usage*: `orchestrate settings set-encoding utf-8`
* **`docker host`**: Choose between default VM docker host and user-managed host.
  * *Options*: `--user-managed` / `--orchestrate`.
  * *Usage*: `orchestrate settings docker host --user-managed`
* **`observability langfuse`**: Manage remote Langfuse settings.
  * *Commands*:
    * `get` (Options: `--output`): Save current config.
    * `configure` (Options: `--url`, `--health-uri`, `--project-id`, `--api-key`, `--config-file`, `--config-json`): Setup integration.
    * `remove`: Delete Langfuse settings.
  * *Usage*: `orchestrate settings observability langfuse configure --url http://lf.com --health-uri http://lf.com/health --project-id my-project --api-key lf-key`

#### Partner packaging (`orchestrate partners`)
* **`offering create`**: Package workspace assets into offering bundles.
  * *Options*: `--offering` (name), `--publisher`, `--type` (`native` or `external`), `--agent-name`.
  * *Usage*: `orchestrate partners offering create --offering "HR Package" --publisher "ACME" --type native --agent-name hr_agent`
* **`offering package`**: Validate and finalize bundle.
  * *Options*: `--offering`, `--folder`.
  * *Usage*: `orchestrate partners offering package --offering "HR Package" --folder ./HR_Package_Folder`

---

### 2.14. Global CLI Flags

These options are valid across the main application:
* **`--version`**: Display versions of both the active ADK and local developer tags, then exit.
* **`--debug`**: Enable python traceback printing (sets `tracebacklimit` to 40 instead of 0).
* **`--help`**: Print contextual subcommands and instructions.
