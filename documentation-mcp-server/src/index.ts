import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { SearchEngine } from './search-engine.js';
import { randomUUID } from 'crypto';
import { VFSEngine } from './vfs-engine.js';

const app = express();

// Parse JSON bodies for POST requests
app.use(express.json());

const port = process.env.PORT || 3000;
const docsDir = process.env.DOCS_DIR || './documentation';

// Initialize the global search engine
const searchEngine = new SearchEngine(docsDir);

// Initialize the global VFS engine
const vfsEngine = new VFSEngine(docsDir, './.vfs');

// Map to track active sessions and their corresponding server/transport instances
interface SessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastAccess: number;
}
const sessions = new Map<string, SessionContext>();

// Helper to register tools on a server instance
function setupServerTools(server: McpServer) {
  // 1. Tool: search
  server.tool(
    'search',
    'Search the IBM watsonx Orchestrate ADK documentation to find the most relevant sections, not just pages. Returns compact section-level results with title, link, sectionTitle, lineRange, category, documentType, summary, hasCodeExamples, relevanceScore, and a suggestedReadCommand for query_docs. Use this tool FIRST. Then read only the suggested line range with query_docs to keep context small and precise. Example workflow: 1) search for "Python tool decorator" → get link "tools/create_tool", sectionTitle, and lineRange like "15-45", 2) query_docs with the suggested command such as "head -n 45 /tools/create_tool.md | tail -n 31".',
    {
      query: z.string().describe('The search query/keywords to find relevant documentation sections')
    },
    async ({ query }) => {
      try {
        console.log(`Executing search tool for query: "${query}"`);
        const results = await searchEngine.search(query, 10);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No search results found for query: "${query}"`
              }
            ]
          };
        }

        const formattedResults = results.map((result: any) => {
          const cleanPath = result.path.replace(/^\//, '').replace(/\.md$/, '');
          const lineStart = Number(result.lineStart || 1);
          const lineEnd = Number(result.lineEnd || lineStart);
          const lineCount = Math.max(lineEnd - lineStart + 1, 1);

          const structuredResult = {
            title: result.pageTitle,
            link: cleanPath,
            sectionTitle: result.sectionTitle || 'Overview',
            lineRange: result.lineRange || `${lineStart}-${lineEnd}`,
            documentType: result.documentType || 'guide',
            category: result.category || 'general',
            summary: result.contentSummary || '',
            hasCodeExamples: result.hasCodeExamples || false,
            relevanceScore: Number((result._relevance_score || 0).toFixed(4)),
            suggestedReadCommand: `head -n ${lineEnd} /${cleanPath}.md | tail -n ${lineCount}`
          };

          return {
            type: 'text' as const,
            text: JSON.stringify(structuredResult, null, 2)
          };
        });

        return {
          content: formattedResults
        };
      } catch (err: any) {
        console.error('Error during search execution:', err);
        return {
          content: [
            {
              type: 'text',
              text: `Error performing search: ${err.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // 2. Tool: query_docs
  server.tool(
    'query_docs',
    'Read content from pages identified by the search tool. This is a read-only shell-like interface to a virtualized filesystem containing ONLY IBM watsonx Orchestrate ADK documentation (markdown files and OpenAPI specs). NOT a real shell - nothing runs on any machine. Typical workflow: 1) use search to find the best section, 2) copy the returned suggestedReadCommand or use the returned lineRange to read only that slice, 3) expand to nearby lines only if needed. Prefer bounded reads over full-file reads to reduce token usage and avoid context rot. Supported commands: cat, head, tail, sed, rg/grep, tree/ls, jq. Examples: "head -n 45 /tools/create_tool.md | tail -n 31", "sed -n \'15,45p\' /tools/create_tool.md", "rg -n -C 2 \'@tool|decorator\' /tools/create_tool.md". Important: each call is STATELESS (working directory resets to /). Use absolute paths or chain commands with &&. Output truncated to 30KB per call.',
    {
      query: z.string().describe('Read-only shell command to inspect documentation, preferably with bounded line ranges')
    },
    async ({ query }) => {
      try {
        console.log(`Executing query_docs tool for query: "${query}"`);
        const result = await vfsEngine.runQuery(query);
        return {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        };
      } catch (err: any) {
        console.error('Error during query_docs execution:', err);
        return {
          content: [
            {
              type: 'text',
              text: err.message || 'Error executing query'
            }
          ],
          isError: true
        };
      }
    }
  );
}

async function start() {
  try {
    // 1. Initialize and build the search index
    await searchEngine.initialize();

    // 2. Initialize the virtual filesystem
    await vfsEngine.initialize();

    // 2. Expose the MCP endpoint to handle both SSE GET and POST requests
    app.all('/mcp', async (req, res) => {
      const sessionIdHeader = req.headers['mcp-session-id'];
      let sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

      // Detect if this is an initialization request (client is starting a new session)
      const isInitialize = req.method === 'POST' && 
                           req.body && 
                           (req.body.method === 'initialize' || 
                            (Array.isArray(req.body) && req.body.some((m: any) => m.method === 'initialize')));

      if (isInitialize) {
        // Generate a new unique session ID
        sessionId = randomUUID();
        console.log(`Initializing new session: ${sessionId}`);

        // Create a new, isolated McpServer instance
        const serverInstance = new McpServer({
          name: 'watsonx-orchestrate-documentation',
          version: '1.0.0'
        });
        setupServerTools(serverInstance);

        // Create a transport specific to this session ID
        const transportInstance = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId!
        });

        // Connect the server to the transport
        await serverInstance.connect(transportInstance);

        // Save session context
        sessions.set(sessionId, {
          server: serverInstance,
          transport: transportInstance,
          lastAccess: Date.now()
        });

        // Set cleanup callback when transport closes
        transportInstance.onclose = () => {
          console.log(`Session closed/disconnected: ${sessionId}`);
          sessions.delete(sessionId!);
        };

        try {
          await transportInstance.handleRequest(req, res, req.body);
        } catch (err) {
          console.error(`Error handling initial request for session ${sessionId}:`, err);
          if (!res.headersSent) {
            res.status(500).send('Internal Server Error');
          }
        }
        return;
      }

      // If not an initialize request, the client must provide a session ID
      if (!sessionId) {
        console.warn('Request rejected: Missing mcp-session-id header');
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Mcp-Session-Id header is required'
          },
          id: null
        });
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`Request rejected: Session ${sessionId} not found`);
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Session not found'
          },
          id: null
        });
        return;
      }

      // Update access time for reaping inactive sessions
      session.lastAccess = Date.now();

      try {
        await session.transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error(`Error handling request for session ${sessionId}:`, err);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
        }
      }
    });

    // Clean up sessions inactive for more than 1 hour (reaper runs every 10 minutes)
    setInterval(() => {
      const now = Date.now();
      const timeout = 60 * 60 * 1000; // 1 hour
      for (const [id, session] of sessions.entries()) {
        if (now - session.lastAccess > timeout) {
          console.log(`Reaping stale session: ${id}`);
          session.transport.close().catch(console.error);
          sessions.delete(id);
        }
      }
    }, 10 * 60 * 1000);

    // 3. Start the server
    app.listen(port, () => {
      console.log(`IBM watsonx Orchestrate MCP server listening on port ${port}`);
      console.log(`MCP endpoint available at http://localhost:${port}/mcp`);
    });
  } catch (error) {
    console.error('Failed to initialize and start server:', error);
    process.exit(1);
  }
}

start();
