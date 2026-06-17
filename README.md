# orchestrate-bob

This repo contains **experiments** how to customize AI-based software development tools like IBM Bob to access IBM watsonx Orchestrate.


## Usage

Copy [bob/2.10.0-official-doc-server/](bob/2.10.0-official-doc-server/) or [bob/2.10.0-custom-doc-server/](bob/2.10.0-custom-doc-server/) in you '.bob' directory.

See blog posts:

* [Accessing watsonx Orchestrate from Bob via CLI](https://heidloff.net/article/watsonx-orchestrate-skill-cli/)
* [Testing watsonx Orchestrate Agents with Bob](https://heidloff.net/article/watsonx-orchestrate-skill-testing/)
* [Developing Documentation MCP Servers for IBM Bob](https://heidloff.net/article/develop-documentation-mcp-servers/)


## watsonx Orchestrate Skill

The repo contains a [watsonx Orchestrate skill](bob/2.10.0-official-doc-server/):

- Describes main Orchestrate assets and defines the lifecycle of creating agents
- Documents how to invoke the 'orchestrate' CLI and when to use the documentation MCP server
- Documents how to import and test generated agents running in the local Orchestrate Developer Edition

Thanks go to [Florin Manaila](https://de.linkedin.com/in/funmachines) for creating the core skill!


## watsonx Orchestrate MCP Server

The folder [documentation-mcp-server](documentation-mcp-server) contains an alternative implementation of the official watsonx Orchestrate MCP server.