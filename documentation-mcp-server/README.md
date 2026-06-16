# documentation-mcp-server

Similar to [MCP Server in ADK](https://developer.watson-orchestrate.ibm.com/mcp_server/wxOmcp_docs_server).


## Tool: search

```text
Search the IBM watsonx Orchestrate ADK documentation to find relevant pages. 
Returns a list of page links with summaries (NO full content or code). 
Each result includes: title, link (path for query_docs), category, documentType, 
summary (brief description without code), hasCodeExamples (boolean), sections 
(list of section titles), and relevanceScore. Use this tool FIRST to identify 
relevant documentation pages. 

Then use query_docs with the returned link to read the full page content 
including code examples. Example workflow: 1) search for "Python tool decorator" 
→ get link "tools/create_tool", 2) query_docs with "cat /tools/create_tool.md" 
→ get full content with code.
```

Example output:

```json
[
    {
    "title": "Authoring agents with the Orchestrate AI Builder",
    "link": "ai_builder/creating_agent",
    "documentType": "guide",
    "summary": "Authoring agents with the Orchestrate AI Builder The Orchestrate AI Builder is a powerful tool that helps you create and refine agents. It simplifies agent creation by allowing you to describe the agent you want. The AI Builder leverages its internal AI to create a new agent from scratch. The AI Bui...",
    "hasCodeExamples": true,
    "sections": [
        "Creating agents",
        "Refining agents",
        "Automatic agent refinement (autotune)"
    ],
    "fileSize": 15243
    },
    {
        ...
    }
]
```

## Tool: query_docs

```text
Read content from pages identified by the search tool. This is a read-only 
shell-like interface to a virtualized filesystem containing ONLY IBM watsonx 
Orchestrate ADK documentation (markdown files and OpenAPI specs). NOT a real 
shell - nothing runs on any machine.

**Typical workflow:** 
1) Use search tool to find relevant pages (returns links like 
"tools/create_tool"), 
2) Use THIS tool to read full content: 
"cat /tools/create_tool.md" (note: add leading / and .md extension to the link 
from search results). Returns complete page content including code examples, 
API specs, and detailed instructions. 

**Supported commands:** cat (read full file), head (read first N lines), 
tail (read last N lines), rg/grep (search with regex), tree/ls (explore structure), 
jq (parse JSON). 

**Examples:** 
- Read full page: "cat /tools/create_tool.md" 
- Read first 100 lines: "head -100 /getting-started/cli.md" 
- Read multiple pages: "cat /tools/create_tool.md /tools/manage_tool.md" 
- Search within files: "rg -C 3 '@tool' /tools/" 
- Explore structure: "tree /apis -L 2" 
- Parse OpenAPI: "cat /openapi/spec.json | jq '.paths | keys'" 

**Important:** 
Each call is STATELESS (working directory resets to /). Use absolute paths 
or chain commands with && (e.g., "cd /apis && ls"). Output truncated to 30KB 
per call.
```


## Usage

Terminal 1:

```bash
./run-docker.sh
```

Terminal 2:

```bash
npx @modelcontextprotocol/inspector
```

http://localhost:3033/mcp