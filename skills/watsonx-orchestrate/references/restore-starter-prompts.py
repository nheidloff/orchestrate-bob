#!/usr/bin/env python3
"""restore-starter-prompts.py — re-apply an agent YAML's starter_prompts after import.

Why (live-verified ADK 2.19.0, IBM Cloud SaaS): `orchestrate agents import` sends skills as
UUIDs; SaaS answers "Skills not found" and the CLI retries with skill names. The first
attempt rewrites the nested starter_prompts dict in place (prompts -> customize), so the
retry sends `customize: []` and the agent is stored with NO starter prompts — silently.
Only agents that have `skills:` are affected. Run this after importing such an agent.

Usage (inside the ADK venv, with the target env active):
    python restore-starter-prompts.py agents/my_agent.yaml [more.yaml ...]

Reads the active env URL and token from the ADK's own config, like wxo-chat.sh.
"""
import json
import os
import sys
import urllib.error
import urllib.request

import yaml


def _env():
    cfg = yaml.safe_load(open(os.path.expanduser("~/.config/orchestrate/config.yaml")))
    name = cfg["context"]["active_environment"]
    url = cfg["environments"][name]["wxo_url"].rstrip("/")
    token = yaml.safe_load(open(os.path.expanduser("~/.cache/orchestrate/credentials.yaml")))["auth"][name]["wxo_mcsp_token"]
    return url, token


def _call(method, url, token, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def restore(spec_path):
    spec = yaml.safe_load(open(spec_path))
    prompts = (spec.get("starter_prompts") or {}).get("prompts") or []
    if not prompts:
        print(f"{spec['name']}: no starter_prompts in {spec_path}, nothing to do")
        return True
    url, token = _env()
    s, agents = _call("GET", f"{url}/v1/orchestrate/agents?names={spec['name']}", token)
    agent = next((a for a in (agents or []) if a.get("name") == spec["name"]), None)
    if not agent:
        print(f"{spec['name']}: not found in the active env ({s})")
        return False
    props = agent.get("additional_properties") or {}
    stored = (props.get("starter_prompts") or {}).get("customize") or []
    if len(stored) == len(prompts):
        print(f"{spec['name']}: {len(stored)} starter prompt(s) already stored")
        return True
    customize = [{"id": p["id"], "title": p["title"], "subtitle": p.get("subtitle") or "",
                  "prompt": p["prompt"], "state": "active"} for p in prompts]
    props["starter_prompts"] = {"customize": customize}
    s, r = _call("PATCH", f"{url}/v1/orchestrate/agents/{agent['id']}", token, {"additional_properties": props})
    ok = s < 300
    print(f"{spec['name']}: stored {len(stored)} -> restored {len(customize)} starter prompt(s) (HTTP {s})")
    return ok


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(0 if all(restore(p) for p in sys.argv[1:]) else 1)
