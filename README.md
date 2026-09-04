# orchestrate-bob

This repo contains utilities to access IBM watsonx Orchestrate from agentic software development tools like IBM Bob. 

There are three components:

1. [watsonx Orchestrate Skill](#watsonx-orchestrate-skill-core)
2. [watsonx Orchestrate Skill Security](#watsonx-orchestrate-skill-aaa)
3. [Experiment how to write documentation MCP servers](#watsonx-orchestrate-documentation-mcp-server)

The agentic assets in this repo have been created by developers in the community.


## watsonx Orchestrate Skill Core

**watsonx-orchestrate**

The [watsonx-orchestrate](skills/watsonx-orchestrate) skill provides several functions:

- Describes main Orchestrate assets and defines the lifecycle of creating agents
- Explains how to build assets, tools, etc. with the ADK (Agent Development Kit)
- Knows how to set up the local 'orchestrate' CLI (Command Line Interface)
- Understands how to invoke the 'orchestrate' CLI and how to use the documentation MCP (Model Context Protocol) server
- Can import assets and run tests against Orchestrate environments
- Knows how to invoke the watsonx Orchestrate APIs
- Helps to embed the watsonx Orchestrate Chat widget in custom applications
- Plus much more ...

The skill supports the watsonx Orchestrate ADK v2.15.0.

Thanks go to [Florin Manaila](https://de.linkedin.com/in/funmachines) for creating most of the skill! 

**Setup**

Copy [skills/watsonx-orchestrate/](skills/watsonx-orchestrate/) in your '.bob/skills/watsonx-orchestrate/' directory.

Put this in '.bob/mcp.json':

```json
{
  "mcpServers": {
    "watsonx-orchestrate-adk-docs": {
      "type": "streamable-http",
      "url": "https://developer.watson-orchestrate.ibm.com/mcp",
      "disabled": false
    }
  }
}
```


## watsonx Orchestrate Skill AAA

**watsonx-orchestrate-aaa**

aaa: Authentication, Authorization, Accountability

The [watsonx-orchestrate-aaa](skills/watsonx-orchestrate-aaa) skill provides several functions:

- Authentication
- Authorization
- Accountability

**Setup**

Copy [skills/watsonx-orchestrate/](skills/watsonx-orchestrate/) in your '.bob/skills/watsonx-orchestrate/' directory.

Copy [skills/watsonx-orchestrate-aaa/](skills/watsonx-orchestrate-aaa/) in your '.bob/skills/watsonx-orchestrate-aaa/' directory.

Put this in '.bob/mcp.json':

```json
{
  "mcpServers": {
    "watsonx-orchestrate-adk-docs": {
      "type": "streamable-http",
      "url": "https://developer.watson-orchestrate.ibm.com/mcp",
      "disabled": false
    }
  }
}
```


## watsonx Orchestrate Documentation MCP Server

The folder [documentation-mcp-server](documentation-mcp-server) contains an alternative implementation of the official watsonx Orchestrate MCP server.

**Setup**

See [README.md](documentation-mcp-server/README.md) for setup instructions.


## Documentation

See blog posts:

* [New Agentic Skill for watsonx Orchestrate](https://heidloff.netarticle/watsonx-orchestrate-skill/)
* [Accessing watsonx Orchestrate Environments via Agentic Skill](https://heidloff.net/article/watsonx-orchestrate-skill-environment/)
* [Testing multi-turn Conversations in watsonx Orchestrate via Agentic Skill](https://heidloff.net/article/watsonx-orchestrate-skill-multi-turn-tests/)
* [Developing Documentation MCP Servers for IBM Bob](https://heidloff.net/article/develop-documentation-mcp-servers/)
* [Accessing watsonx Orchestrate from Bob via CLI](https://heidloff.net/article/watsonx-orchestrate-skill-cli/)
* [Testing watsonx Orchestrate Agents with Bob](https://heidloff.net/article/watsonx-orchestrate-skill-testing/)
* [Watsonx Orchestrate Debug Skill for IBM Bob](https://heidloff.net/article/bob-debug-orchestrate/)