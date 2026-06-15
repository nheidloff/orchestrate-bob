# Environment Management (`orchestrate env`)
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

# Workspace Management (`orchestrate workspaces`)
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

## Workspace Members (`orchestrate workspaces members`)
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


# Local Server Management (`orchestrate server`)
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

# Channels (`orchestrate channels`)
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


# Phone Integrations (`orchestrate phone`)
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


# System Settings (`orchestrate settings`)
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


# Partner packaging (`orchestrate partners`)
* **`offering create`**: Package workspace assets into offering bundles.
  * *Options*: `--offering` (name), `--publisher`, `--type` (`native` or `external`), `--agent-name`.
  * *Usage*: `orchestrate partners offering create --offering "HR Package" --publisher "ACME" --type native --agent-name hr_agent`
* **`offering package`**: Validate and finalize bundle.
  * *Options*: `--offering`, `--folder`.
  * *Usage*: `orchestrate partners offering package --offering "HR Package" --folder ./HR_Package_Folder`