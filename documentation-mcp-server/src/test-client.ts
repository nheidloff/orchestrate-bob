import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function run() {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  console.log('Connecting to MCP server via Streamable HTTP...');
  await client.connect(transport);
  console.log('Connected!');

  console.log('Listing tools...');
  const tools = await client.listTools();
  console.log('Tools:', JSON.stringify(tools, null, 2));

  console.log('Running search for "what is"...');
  const result = await client.callTool({
    name: 'search',
    arguments: {
      query: 'what is'
    }
  });

  console.log('Search Result:', JSON.stringify(result, null, 2));

  await client.close();
}

run().catch(console.error);
