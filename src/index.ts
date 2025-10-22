import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = new McpServer({
      name: "hello-world",
      version: "1.0.0",
    });

    server.registerResource(
      "hello-widget",
      "ui://widget/hello.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://widget/hello.html",
            mimeType: "text/html+skybridge",
            text: `
            <h1 style="color: red;">Hello, world!</h1>`,
          },
        ],
      })
    );

    server.registerTool(
      "say-hello-with-ui",
      {
        title: "Say hello with UI",
        description: "Say hello to the world with a UI",
        _meta: {
          // this has to match the uri of the resource we registered above
          "openai/outputTemplate": "ui://widget/hello.html",
          // loading message
          "openai/toolInvocation/invoking": "Loading UI",
          // loaded message
          "openai/toolInvocation/invoked": "Loaded UI",
        },
      },
      () => {
        return {
          content: [
            {
              type: "text",
              text: "Showing UI",
            },
          ],
        };
      }
    );

    server.registerResource(
      "red-rext",
      "ui://widget/red-text.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://widget/hello.html",
            mimeType: "text/html+skybridge",
            text: `
            <script>
              document.addEventListener('DOMContentLoaded', function() {
                const textElement = document.getElementById("text");
                textElement.innerText = window.openai.toolInput.text;
            });
            </script>
            
            <div style="height: 300px;"><h1 style="color: red;" id="text"></h1></div>`,
          },
        ],
      })
    );

    server.registerTool(
      "make-text-red",
      {
        title: "Make text red",
        description: "Makes text red",
        _meta: {
          "openai/outputTemplate": "ui://widget/red-text.html",
          "openai/toolInvocation/invoking": "Loading red text",
          "openai/toolInvocation/invoked": "Loaded red text",
        },
        inputSchema: {
          text: z.string().describe("The text to make ted"),
        },
      },
      async () => ({
        content: [{ type: "text", text: "Making text red" }],
      })
    );

    server.registerTool(
      "say-hello",
      {
        title: "Say hello",
        description: "Say hello to the world",
      },
      () => {
        return {
          content: [
            {
              type: "text",
              text: "Hello, we're building a ChatGPT app with OpenAI SDK!",
            },
          ],
        };
      }
    );

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.listen(3000);
