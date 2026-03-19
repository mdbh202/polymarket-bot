import { Client } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

async function findInconsistencies() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/polymarket-server.js"],
  });

  const client = new Client({
    name: "logic-scanner",
    version: "1.0.0",
  });

  await client.connect(transport);

  try {
    console.log("Fetching potential mutually-exclusive markets (Winner/Election/Will)...");
    const result = await client.callTool({
      name: "get_markets",
      arguments: { limit: 100, sort_by: "volume" },
    });
    
    const markets = JSON.parse(result.content[0].text);
    
    // Group by common question patterns
    const groups = {};
    markets.forEach(m => {
        // Find commonality: e.g. "Who will win the NBA Finals?"
        // We look for questions that are very similar but have different outcomes
        const key = m.question.split('?')[0].trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
    });

    console.log("----------------------------------------");
    console.log("LOGICAL INCONSISTENCY REPORT (Edge 5)");
    console.log("----------------------------------------");

    for (const [question, outcomes] of Object.entries(groups)) {
        if (outcomes.length > 1) {
            // Mutually exclusive assumption: only one outcome can happen
            // (Note: This is a simplification; need to verify if the market is actually a group)
            const probSum = outcomes.reduce((acc, m) => acc + (m.yes_price || 0), 0);
            
            if (probSum > 1.05) {
                console.log(`⚠️  INCONSISTENCY FOUND: "${question}"`);
                console.log(`   Prob Sum: ${(probSum * 100).toFixed(1)}% (Should be ~100%)`);
                outcomes.forEach(o => {
                    console.log(`   - Outcome: ${o.question} | Price: ${o.yes_price}`);
                });
                console.log(`   Strategy: Cross-Market Arb (Buy NO on all if sum > 1.05)`);
                console.log("----------------------------------------");
            }
        }
    }
  } catch (error) {
    console.error("Logic Scan Error:", error);
  } finally {
    await client.close();
  }
}

findInconsistencies();
