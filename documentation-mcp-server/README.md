# documentation-mcp-server

This folder contains an exploration of how to implement efficient MCP documentation servers and tools, similar to the [Orchestrate Documentation MCP Server](https://developer.watson-orchestrate.ibm.com/mcp_server/wxOmcp_docs_server) with two tools 'search' and 'query_docs'. Read [Developing Documentation MCP Servers for IBM Bob](https://heidloff.net/article/develop-documentation-mcp-servers/) for details.


## Tool: search

```text
Search the IBM watsonx Orchestrate ADK documentation to find the most relevant sections, not 
just pages. Returns compact section-level results with title, link, sectionTitle, lineRange, 
category, documentType, summary, hasCodeExamples, relevanceScore, and a suggestedReadCommand 
for query_docs. 

Use this tool FIRST. Then read only the suggested line range with query_docs to keep context 
small and precise. 

Example workflow: 
1) search for "Python tool decorator" → get link "tools/create_tool", sectionTitle, and 
   lineRange like "15-45"
2) query_docs with the suggested command such as 
   "head -n 45 /tools/create_tool.md | tail -n 31"
```

Example output:

```json
[
  {
    "title": "Authoring Python-Based Tools",
    "link": "tools/create_tool",
    "sectionTitle": "Importing Python-based tools",
    "lineRange": "169-329",
    "documentType": "guide",
    "category": "create_tool.md",
    "summary": "You can import Python-based tools in two forms: as an individual ...",
    "hasCodeExamples": true,
    "relevanceScore": 1.66,
    "suggestedReadCommand": "head -n 329 /tools/create_tool.md | tail -n 161"
  },
  {
    "...": "..."
  }
]
```


## Tool: query_docs

```text
Read content from pages identified by the search tool. This is a read-only shell-like 
interface to a virtualized filesystem containing ONLY IBM watsonx Orchestrate ADK documentation 
(markdown files and OpenAPI specs). NOT a real shell - nothing runs on any machine.

Typical workflow:
1) use search to find the best matching section,
2) copy the returned suggestedReadCommand or use the returned lineRange to read only that slice
3) expand to nearby lines only if needed. Prefer bounded reads over full-file reads to reduce 
   token usage and avoid context rot.

Supported commands: cat, head, tail, sed, rg/grep, tree/ls, jq

Examples: 
"head -n 45 /tools/create_tool.md | tail -n 31", 
"sed -n \'15,45p\' /tools/create_tool.md", 
"rg -n -C 2 \'@tool|decorator\' /tools/create_tool.md".

Important: each call is STATELESS (working directory resets to /). Use absolute paths or chain 
commands with &&. Output truncated to 30KB per call.
```


## Usage in MCP Inspector

Terminal 1:

```bash
git clone https://github.com/nheidloff/orchestrate-bob.git
cd documentation-mcp-server
./download-documentation.sh
./run-docker.sh
```

Terminal 2:

```bash
npx @modelcontextprotocol/inspector
```

http://localhost:3033/mcp


## Usage in IBM Bob

Put this in .bob/mcp.json:

```json
{
    "mcpServers": {
        "watsonx-orchestrate-documentation": {
            "type": "streamable-http",
            "url": "http://localhost:3033/mcp",
            "alwaysAllow": [
                "search",
                "query_docs"
            ],
            "disabled": false
        }
    }
}
```

Overwrite the following section in [SKILL.md](../skills/watsonx-orchestrate/SKILL.md):

```markdown
## 9. Working alongside the MCP servers

There are two MCP servers for wxO. If they are installed and available, use them!
See `.bob/mcp.json` whether they are configured and not disabled.

**1. MCP Documentation Server**
INSERT HERE and overwrite the existing instruction.
```

```markdown
Important: Rather than guessing, you must utilize the MCP documentation server 
'watsonx-orchestrate-documentation' and the tools: 'search' and 'query_docs'!

*search*

Search the watsonx Orchestrate documentation to find relevant content. Returns a list of 
page links with summaries and meta data (NO full content or code). Use this tool first 
(before query_docs).

*query_docs*

Read content from pages identified by the search tool. This is a read-only shell-like 
interface to a virtualized filesystem containing only watsonx Orchestrate documentation. 

Example workflow: 
1) search for "Python tool decorator" → get link "tools/create_tool", sectionTitle, and 
   lineRange like "15-45"
2) query_docs with the suggested command such as 
   "head -n 45 /tools/create_tool.md | tail -n 31"
```