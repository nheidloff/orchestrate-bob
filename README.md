# orchestrate-bob

This repo contains experiments how to customize AI-based software development tools like IBM Bob to access IBM watsonx Orchestrate.


## watsonx Orchestrate Skill

[bob/2.10.0](bob/2.10.0-official-doc-server/) contains a watsonx Orchestrate skill:

- Describes main Orchestrate assets and defines the lifecycle of creating agents
- Documents how to invoke the 'orchestrate' CLI and when to use the documentation MCP server
- Documents how to import and test generated agents running in the local Orchestrate Developer Edition

Thanks go to [Florin Manaila](https://de.linkedin.com/in/funmachines) for creating the core skill!


## watsonx Orchestrate MCP Server

[documentation-mcp-server](documentation-mcp-server) will contain an alternative implementation of the official watsonx Orchestrate MCP server.