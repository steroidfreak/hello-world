import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = new McpServer({
      name: "hello-world",
      version: "1.0.0",
    });

    const weatherBundlePath = path.resolve(process.cwd(), "dist/weatherWidget.js");

    const loadWeatherBundle = () => {
      try {
        return fs.readFileSync(weatherBundlePath, "utf8");
      } catch (error) {
        console.warn("Weather widget bundle missing. Run `npm run build` to generate it.", error);
        return null;
      }
    };

    const defaultWeatherApiKey =
      process.env.OPENWEATHER_API_KEY ?? process.env.WEATHER_API_KEY ?? undefined;

    const escapeScript = (code: string) => code.replace(/<\/script>/g, "<\\/script>");

    const buildWeatherHtml = (bundle: string | null) => {
      if (bundle === null) {
        return `
            <div style="padding: 32px; font-family: 'Segoe UI', Arial, sans-serif; background: #111827; color: #f87171;">
              <h2 style="margin-top: 0;">Weather widget bundle not found</h2>
              <p>Run <code>npm run build</code> to generate <code>dist/weatherWidget.js</code> before invoking this tool.</p>
            </div>`;
      }

      const fallbackScript = defaultWeatherApiKey
        ? `const __fallbackApiKey = ${JSON.stringify(defaultWeatherApiKey)};
              if (!input.apiKey) {
                input.apiKey = __fallbackApiKey;
              }`
        : "";

      const missingKeyWarning =
        defaultWeatherApiKey === undefined
          ? `if (!input.apiKey) {
                const warningHtml = ${JSON.stringify(
                  `<div style="padding: 32px; font-family: 'Segoe UI', Arial, sans-serif; background: #111827; color: #facc15; border-radius: 16px;">
                  <h2 style="margin-top: 0;">Weather API key required</h2>
                  <p>Provide an <code>apiKey</code> parameter or set <code>OPENWEATHER_API_KEY</code> in your environment.</p>
                </div>`
                )};
                container.innerHTML = warningHtml;
                return;
              }`
          : "";

      return `
            <div id="app"></div>
            <script type="module">
            ${escapeScript(bundle)}
            (async () => {
              const container = document.getElementById("app");
              const input = Object.assign({}, window.openai?.toolInput);
              if (!container) {
                throw new Error("Weather widget container missing.");
              }
              container.innerHTML = '';
              ${fallbackScript}
              ${missingKeyWarning}
              let initialData = undefined;
              if (input.lat !== undefined && input.lon !== undefined && input.apiKey) {
                try {
                  const params = new URLSearchParams({
                    lat: String(input.lat),
                    lon: String(input.lon),
                    appid: input.apiKey,
                  });
                  if (input.units && input.units !== "standard") {
                    params.set("units", input.units);
                  }
                  const response = await fetch(\`https://api.openweathermap.org/data/2.5/weather?\${params.toString()}\`);
                  if (response.ok) {
                    initialData = await response.json();
                  } else {
                    console.warn("Weather prefetch failed", response.status, response.statusText);
                  }
                } catch (error) {
                  console.warn("Weather prefetch error", error);
                }
              }
              if (window.renderWeatherWidget) {
                window.renderWeatherWidget(container, { ...input, initialData });
              } else {
                container.innerHTML = '<div style="padding:24px;color:#ef4444;font-family:Segoe UI,Arial,sans-serif;">Failed to initialize weather widget.</div>';
              }
            })().catch((error) => {
              console.error("Error bootstrapping weather widget:", error);
            });
            </script>`;
    };

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
      "insights-dashboard",
      "ui://widget/insights-dashboard.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://widget/insights-dashboard.html",
            mimeType: "text/html+skybridge",
            text: `
            <style>
              :root {
                color-scheme: light;
                font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
                background-color: #f5f7fb;
              }
              body {
                margin: 0;
                padding: 24px;
                background: linear-gradient(135deg, #eef2ff, #f5f7fb 60%, #ffffff);
                color: #1f2933;
              }
              .card {
                max-width: 720px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 16px 32px rgba(31, 41, 51, 0.08);
                overflow: hidden;
                border: 1px solid #e1e7ef;
              }
              .header {
                padding: 32px 32px 16px;
                border-bottom: 1px solid #eef2f7;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .header p {
                margin-top: 12px;
                margin-bottom: 0;
                color: #52616f;
                font-size: 16px;
                line-height: 1.5;
              }
              .table-wrapper {
                padding: 24px 32px 32px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              thead {
                background-color: #f5f8ff;
              }
              th, td {
                padding: 14px 16px;
                text-align: left;
                font-size: 15px;
                border-bottom: 1px solid #eef2f7;
              }
              th {
                color: #3b4754;
                font-weight: 600;
              }
              tbody tr:last-child td {
                border-bottom: none;
              }
              .tag {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 13px;
                font-weight: 600;
                background: rgba(59, 130, 246, 0.12);
                color: #1d4ed8;
              }
              .metric {
                font-weight: 600;
                color: #2563eb;
              }
            </style>
            <div class="card">
              <div class="header">
                <h1>Product Metrics Overview</h1>
                <p>Snapshot of current performance indicators with helpful descriptions for quick decision making.</p>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Current Value</th>
                      <th>Trend</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Active Users</td>
                      <td class="metric">18,240</td>
                      <td><span class="tag">+12% WoW</span></td>
                      <td>Growth driven by the new onboarding flow launched last week.</td>
                    </tr>
                    <tr>
                      <td>Revenue</td>
                      <td class="metric">$94,600</td>
                      <td><span class="tag">+6% WoW</span></td>
                      <td>Subscriptions up 8%; upgrades from free tier stable.</td>
                    </tr>
                    <tr>
                      <td>Support Tickets</td>
                      <td class="metric">146</td>
                      <td><span class="tag">-18% WoW</span></td>
                      <td>AI assistant deflected 34% of inquiries during peak hours.</td>
                    </tr>
                    <tr>
                      <td>Deployment Frequency</td>
                      <td class="metric">24 releases</td>
                      <td><span class="tag">+3 releases</span></td>
                      <td>Platform stabilization improved release cadence.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>`,
          },
        ],
      })
    );

    server.registerTool(
      "show-insights-dashboard",
      {
        title: "Show insights dashboard",
        description: "Display a polished dashboard with key metrics and descriptions.",
        _meta: {
          "openai/outputTemplate": "ui://widget/insights-dashboard.html",
          "openai/toolInvocation/invoking": "Loading insights dashboard",
          "openai/toolInvocation/invoked": "Insights dashboard ready",
        },
      },
      () => ({
        content: [
          {
            type: "text",
            text: "Rendering insights dashboard UI",
          },
        ],
      })
    );

    server.registerResource(
      "react-product-catalog",
      "ui://widget/react-product-catalog.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://widget/react-product-catalog.html",
            mimeType: "text/html+skybridge",
            text: `
            <div id="app"></div>
            <style>
              :root {
                color-scheme: light;
              }
              body {
                margin: 0;
                padding: 32px;
                font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
                background: radial-gradient(circle at top, #eef2ff 0%, #ffffff 55%);
                color: #111827;
              }
              .wrapper {
                max-width: 960px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 24px;
              }
              .header {
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 32px;
                font-weight: 700;
              }
              .header p {
                margin: 12px auto 0;
                max-width: 640px;
                color: #4b5563;
                font-size: 16px;
                line-height: 1.6;
              }
              .grid {
                display: grid;
                gap: 20px;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
              }
              .card {
                background: #ffffff;
                border-radius: 18px;
                padding: 20px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
                border: 1px solid rgba(226, 232, 240, 0.8);
                display: flex;
                flex-direction: column;
                gap: 12px;
              }
              .badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(59, 130, 246, 0.1);
                color: #1d4ed8;
                border-radius: 999px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                align-self: flex-start;
              }
              .card h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
              }
              .description {
                margin: 0;
                color: #556070;
                font-size: 14px;
                line-height: 1.6;
                flex-grow: 1;
              }
              .price {
                font-weight: 700;
                font-size: 18px;
                color: #2563eb;
              }
            </style>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script>
              (function () {
                const defaultProducts = [
                  {
                    name: "FocusFlow Planner",
                    category: "Productivity",
                    description: "Guided daily planning with AI summarization and calendar sync.",
                    price: "$18/mo"
                  },
                  {
                    name: "Canvas Studio",
                    category: "Design",
                    description: "Collaborative canvas with version history and reusable design kits.",
                    price: "$32/mo"
                  },
                  {
                    name: "Pulse Analytics",
                    category: "Operations",
                    description: "Real-time ops dashboard with anomaly detection and smart alerts.",
                    price: "$89/mo"
                  },
                  {
                    name: "Atlas Docs",
                    category: "Knowledge Base",
                    description: "Docs with AI search, auto-tagging, and secure workspace sharing.",
                    price: "$24/mo"
                  }
                ];

                const inputProducts = window.openai && window.openai.toolInput && Array.isArray(window.openai.toolInput.products)
                  ? window.openai.toolInput.products
                  : null;

                const products = inputProducts && inputProducts.length > 0 ? inputProducts : defaultProducts;

                function ProductCard(props) {
                  const product = props.product;
                  return React.createElement(
                    "div",
                    { className: "card" },
                    React.createElement(
                      "span",
                      { className: "badge" },
                      product.category || "Featured"
                    ),
                    React.createElement(
                      "h3",
                      null,
                      product.name || "Untitled product"
                    ),
                    React.createElement(
                      "p",
                      { className: "description" },
                      product.description || "No description provided."
                    ),
                    React.createElement(
                      "span",
                      { className: "price" },
                      product.price || ""
                    )
                  );
                }

                function CatalogApp() {
                  return React.createElement(
                    "div",
                    { className: "wrapper" },
                    React.createElement(
                      "div",
                      { className: "header" },
                      React.createElement("h1", null, "Product Experience Catalog"),
                      React.createElement(
                        "p",
                        null,
                        "A curated set of product experiences with rich descriptions, powered by a React component."
                      )
                    ),
                    React.createElement(
                      "div",
                      { className: "grid" },
                      products.map(function (product, index) {
                        return React.createElement(ProductCard, { product: product, key: (product.name || "product") + index });
                      })
                    )
                  );
                }

                const container = document.getElementById("app");
                if (!container) {
                  return;
                }
                const root = ReactDOM.createRoot(container);
                root.render(React.createElement(CatalogApp));
              })();
            </script>`,
          },
        ],
      })
    );

    server.registerTool(
      "render-react-catalog",
      {
        title: "Render React catalog",
        description: "Show a React-based catalog component with cards and rich copy.",
        _meta: {
          "openai/outputTemplate": "ui://widget/react-product-catalog.html",
          "openai/toolInvocation/invoking": "Mounting React component",
          "openai/toolInvocation/invoked": "React component rendered",
        },
        inputSchema: {
          products: z
            .array(
              z.object({
                name: z.string().optional(),
                category: z.string().optional(),
                description: z.string().optional(),
                price: z.string().optional(),
              })
            )
            .describe("List of product-like objects to populate the catalog.")
            .optional(),
        },
      },
      () => ({
        content: [
          {
            type: "text",
            text: "Rendering React catalog UI",
          },
        ],
      })
    );

    server.registerResource(
      "react-color-playground",
      "ui://widget/react-color-playground.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://widget/react-color-playground.html",
            mimeType: "text/html+skybridge",
            text: `
            <div id="app"></div>
            <style>
              :root {
                color-scheme: light;
              }
              body {
                margin: 0;
                padding: 32px;
                font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
                background: #f8fafc;
                color: #111827;
              }
              .playground {
                max-width: 640px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 20px;
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
                border: 1px solid rgba(226, 232, 240, 0.9);
                overflow: hidden;
              }
              .playground-inner {
                padding: 36px;
                display: flex;
                flex-direction: column;
                gap: 24px;
                transition: background-color 240ms ease-in-out, color 240ms ease-in-out;
                min-height: 250px;
              }
              .header {
                display: flex;
                flex-direction: column;
                gap: 8px;
              }
              .header h2 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
              }
              .header p {
                margin: 0;
                font-size: 15px;
                color: rgba(15, 23, 42, 0.72);
              }
              .actions {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
              }
              button {
                all: unset;
                cursor: pointer;
                border-radius: 999px;
                padding: 12px 22px;
                font-size: 15px;
                font-weight: 600;
                transition: transform 160ms ease, box-shadow 160ms ease;
                box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16);
                background: linear-gradient(135deg, #60a5fa, #2563eb);
                color: white;
              }
              button:hover {
                transform: translateY(-2px);
                box-shadow: 0 16px 26px rgba(37, 99, 235, 0.22);
              }
            </style>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script>
              (function () {
                function randomColor() {
                  var hue = Math.floor(Math.random() * 360);
                  var saturation = Math.floor(Math.random() * 20) + 60;
                  var lightness = Math.floor(Math.random() * 20) + 45;
                  return "hsl(" + hue + " " + saturation + "% " + lightness + "%)";
                }

                function ColorPlayground() {
                  var _React$useState = React.useState(randomColor()),
                    background = _React$useState[0],
                    setBackground = _React$useState[1];
                  var _React$useState2 = React.useState("#111827"),
                    textColor = _React$useState2[0],
                    setTextColor = _React$useState2[1];

                  return React.createElement(
                    "div",
                    { className: "playground" },
                    React.createElement(
                      "div",
                      {
                        className: "playground-inner",
                        style: {
                          backgroundColor: background,
                          color: textColor,
                        },
                      },
                      React.createElement(
                        "div",
                        { className: "header" },
                        React.createElement(
                          "h2",
                          null,
                          "Dynamic Color Playground"
                        ),
                        React.createElement(
                          "p",
                          null,
                          "Use the buttons below to shuffle background or text colors. Each press picks a fresh hue."
                        )
                      ),
                      React.createElement(
                        "div",
                        { className: "actions" },
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            onClick: function () {
                              setBackground(randomColor());
                            },
                          },
                          "Randomize Background"
                        ),
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            onClick: function () {
                              setTextColor(randomColor());
                            },
                            style: {
                              background: "linear-gradient(135deg, #f97316, #db2777)",
                            },
                          },
                          "Randomize Text"
                        )
                      )
                    )
                  );
                }

                var container = document.getElementById("app");
                if (!container) {
                  return;
                }
                var root = ReactDOM.createRoot(container);
                root.render(React.createElement(ColorPlayground));
              })();
            </script>`,
          },
        ],
      })
    );

    server.registerTool(
      "render-react-color-playground",
      {
        title: "Render React color playground",
        description: "Launch a React component with buttons that randomize background and text colors.",
        _meta: {
          "openai/outputTemplate": "ui://widget/react-color-playground.html",
          "openai/toolInvocation/invoking": "Setting up color playground",
          "openai/toolInvocation/invoked": "Color playground ready",
        },
      },
      () => ({
        content: [
          {
            type: "text",
            text: "Rendering React color playground UI",
          },
        ],
      })
    );

    server.registerResource(
      "react-weather-widget",
      "ui://widget/react-weather-widget.html",
      {},
      async () => {
        const bundle = loadWeatherBundle();
        const html = buildWeatherHtml(bundle);
        return {
          contents: [
            {
              uri: "ui://widget/react-weather-widget.html",
              mimeType: "text/html+skybridge",
              text: html,
            },
          ],
        };
      }
    );

    server.registerTool(
      "render-weather-widget",
      {
        title: "Render weather widget",
        description: "Fetch and display live weather conditions with a React-powered dashboard.",
        _meta: {
          "openai/outputTemplate": "ui://widget/react-weather-widget.html",
          "openai/toolInvocation/invoking": "Gathering weather data",
          "openai/toolInvocation/invoked": "Weather widget ready",
        },
        inputSchema: {
          lat: z
            .union([z.number(), z.string()])
            .describe("Latitude coordinate in decimal degrees."),
          lon: z
            .union([z.number(), z.string()])
            .describe("Longitude coordinate in decimal degrees."),
          apiKey: z
            .string()
            .min(1)
            .describe("OpenWeather API key. Optional if OPENWEATHER_API_KEY is set in the server environment.")
            .optional(),
          units: z
            .enum(["standard", "metric", "imperial"])
            .describe("Unit system for temperature and wind speed.")
            .optional(),
          title: z.string().describe("Optional custom heading for the widget.").optional(),
        },
      },
      () => ({
        content: [
          {
            type: "text",
            text: "Rendering weather widget UI",
          },
        ],
      })
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
