# documentation-mcp-server

Similar to [MCP Server in ADK](https://developer.watson-orchestrate.ibm.com/mcp_server/wxOmcp_docs_server).


## Tool: search

```text
Search the IBM watsonx Orchestrate ADK documentation to find the most relevant sections, not 
just pages. Returns compact section-level results with title, link, sectionTitle, lineRange, 
category, documentType, summary, hasCodeExamples, relevanceScore, and a suggestedReadCommand 
for query_docs. 

Use this tool FIRST. Then read only the suggested line range with query_docs to keep context 
small and precise. 

Example workflow: 
1) search for "Python tool decorator" → get link "tools/create_tool", sectionTitle, and lineRange like "15-45"
2) query_docs with the suggested command such as "head -n 45 /tools/create_tool.md | tail -n 31"
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
Read content from pages identified by the search tool. This is a read-only
shell-like interface to a virtualized filesystem containing ONLY IBM watsonx
Orchestrate ADK documentation (markdown files and OpenAPI specs). NOT a real
shell - nothing runs on any machine.

Typical workflow:
1) use search to find the best matching section,
2) copy the returned suggestedReadCommand or use the returned lineRange to 
   read only that slice
3) expand to nearby lines only if needed. Prefer bounded reads over full-file 
   reads to reduce token usage and avoid context rot.

Supported commands: cat, head, tail, sed, rg/grep, tree/ls, jq

Examples: 
"head -n 45 /tools/create_tool.md | tail -n 31", 
"sed -n \'15,45p\' /tools/create_tool.md", 
"rg -n -C 2 \'@tool|decorator\' /tools/create_tool.md".

Important: each call is STATELESS (working directory resets to /). Use absolute 
paths or chain commands with &&. Output truncated to 30KB per call.
```


## Usage

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