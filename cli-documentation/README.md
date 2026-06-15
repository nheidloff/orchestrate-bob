# Create CLI Documentation for Skill

The ADK provides a [watsonx Orchestrate ADK MCP Server](https://developer.watson-orchestrate.ibm.com/mcp_server/wxOmcp_installation). Alternatively the 'orchestrate' CLI can be invoked directly by AI-based development tools like IBM Bob via skills.

Below one way is described how to create the documentation of a CLI via agents. The 'orchestrate' CLI code is available as open-source as well as the code of the MCP server. Via a simple prompt the documentation is generated.

## Preparation

Clone https://github.com/IBM/ibm-watsonx-orchestrate-adk.git

Copy [src/ibm_watsonx_orchestrate/cli](https://github.com/IBM/ibm-watsonx-orchestrate-adk/tree/main/src/ibm_watsonx_orchestrate/cli) in [cli](cli).

Copy [packages/mcp-server/ibm_watsonx_orchestrate_mcp_server](https://github.com/IBM/ibm-watsonx-orchestrate-adk/tree/main/packages/mcp-server/ibm_watsonx_orchestrate_mcp_server) in [mcp_server](mcp_server).


## Prompt

```text
Create a markdown file which can be used in an agentic skill to desribe the 'orchestrate' CLI. 

The implementation is in the 'cli' folder. 
The 'mcp_server' folder contains a MCP server with the same functionality that you can read to 
better understand how the CLI works. 

Read 'cli' and 'mcp_server' to understand the functionality of the CLI. The generated markdown 
file needs to contain exact documentation how to use the CLI so that agents like IBM Bob, 
Claude Code and Codex can understand and execute it. 

Create an implementation plan first before you start with the generation of the markdown file.
```