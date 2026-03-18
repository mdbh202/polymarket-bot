import { Client } from "./mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "./mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

async function test() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/polymarket-server.js"],
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  await client.connect(transport);

  try {
    const result = await client.callTool({
      name: "get_orderbook",
      arguments: { token_id: "68651215661669695672235506829747686724194100790999648420763714425224567728520" }, // Netanyahu YES token
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Tool Call Error:", error);
  } finally {
    await client.close();
  }
}

test();
