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

  // Need to set up the client's capabilities if required by the SDK version
  await client.connect(transport);

  try {
    console.log("Testing calculate_kelly tool (Success case)...");
    const result1 = await client.callTool({
      name: "calculate_kelly",
      arguments: {
        probability: 0.75,
        token_id: "68651215661669695672235506829747686724194100790999648420763714425224567728520",
        portfolio_size: 1000,
        multiplier: 0.25
      },
    });
    console.log(JSON.stringify(result1, null, 2));

    console.log("\nTesting calculate_kelly tool (Rejection case - low edge)...");
    const result2 = await client.callTool({
      name: "calculate_kelly",
      arguments: {
        probability: 0.05, // Entry price is ~0.028, so edge is small. (0.05 - 0.028) - 0.02 = 0.002 < 0.025
        token_id: "68651215661669695672235506829747686724194100790999648420763714425224567728520",
        portfolio_size: 1000,
        multiplier: 0.25
      },
    });
    console.log(JSON.stringify(result2, null, 2));

  } catch (error) {
    console.error("Tool Call Error:", error);
  } finally {
    await client.close();
  }
}

test();
