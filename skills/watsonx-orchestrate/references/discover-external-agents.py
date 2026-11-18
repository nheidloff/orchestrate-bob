#!/usr/bin/env python3
"""discover-external-agents.py — workaround for `orchestrate agents discover --provider …` on SaaS.

Why (live-verified ADK 2.19.0, IBM Cloud SaaS): discovery runs ON YOUR MACHINE and reads the
cloud credentials back from the wxO connection (GET /connections/applications/runtime_credentials).
On SaaS that call (1) returns a wrapper — your entries sit under `credentials_key`, so the CLI's
top-level key check always fails with "Connection '<app>' is missing the '<key>' credential
entry" — and (2) returns every value MASKED as "****", so even unwrapped they are useless.
`bedrock_agent`, `vertex_agent` and `azure_ai_foundry` all fail this way.

This script feeds the same key/value entries from a LOCAL file instead (keep it gitignored),
then runs the ADK's own discovery and registration code unchanged. The registered external
agents carry `auth_scheme: NONE` and no connection reference, exactly as the CLI would create.

    python discover-external-agents.py bedrock_agent    creds.env [--name "Agent A" ...] [--yes]
    python discover-external-agents.py vertex_agent     creds.env [--name ...] [--yes]
    python discover-external-agents.py azure_ai_foundry creds.env [--name ...]   # always prompts

creds.env holds KEY=VALUE lines with the keys the CLI expects:
    bedrock_agent:    access_key_id, secret_access_key, region [, session_token]
    vertex_agent:     service_account_json (the JSON on one line, or @/path/to/sa.json), project_id, location
    azure_ai_foundry: tenant_id, client_id, client_secret, endpoint, project_name
bedrock_agent also needs botocore:  pip install "ibm-watsonx-orchestrate[aws]"
"""
import argparse

import ibm_watsonx_orchestrate.cli.commands.agents.agents_controller as ac


def _load(path):
    creds = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip("'\"")
        if v.startswith("@"):
            v = open(v[1:]).read()
        creds[k.strip()] = v
    return creds


class _LocalCredentials:
    def __init__(self, creds):
        self._creds = creds

    def get_credentials(self, *args, **kwargs):
        return dict(self._creds)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("provider", choices=["bedrock_agent", "vertex_agent", "azure_ai_foundry"])
    p.add_argument("creds_file", help="local KEY=VALUE file with the provider's credential entries")
    p.add_argument("--name", action="append", help="name filter (repeatable, case-insensitive)")
    p.add_argument("--yes", "-y", action="store_true", help="skip the import confirmation (not for azure_ai_foundry)")
    a = p.parse_args()

    local = _LocalCredentials(_load(a.creds_file))
    ac.get_connections_client = lambda: local
    ctl = ac.AgentsController()
    app_id = "local-credentials"  # only checked for presence by the controller
    if a.provider == "bedrock_agent":
        ctl.discover_and_register_bedrock_agents(app_id=app_id, agents=a.name, yes=a.yes)
    elif a.provider == "vertex_agent":
        ctl.discover_and_register_vertex_agents(app_id=app_id, agents=a.name, yes=a.yes)
    else:
        ctl.discover_and_register_azure_ai_foundry_agents(app_id=app_id, agents=a.name)


if __name__ == "__main__":
    main()
