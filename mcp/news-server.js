/**
 * News MCP Server
 * Exposes: search_news, get_prediction_market_consensus
 * Install: cd mcp && npm install
 * Optional: set NEWSDATA_API_KEY in .env for live news feed
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

const tierSources = JSON.parse(readFileSync(new URL('./tier-sources.json', import.meta.url)));

const server = new Server(
  {
    name: "news",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function getSourceTier(domain) {
  const source = tierSources.sources[domain.toLowerCase()];
  if (source) return { tier: source.tier, reliability: source.reliability };
  return { tier: tierSources.default_tier, reliability: tierSources.default_reliability };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_news",
        description: "Search for news articles and rank them by reliability tier.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search terms" },
            from_date: { type: "string", description: "ISO8601 date, default 7 days ago" },
            recency: { type: "string", enum: ["breaking", "today", "week"], default: "today" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_prediction_market_consensus",
        description: "Fetch community consensus from Metaculus for a specific question.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "The market question to find consensus for" }
          },
          required: ["question"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const apiKey = process.env.NEWSDATA_API_KEY;

  try {
    if (name === "search_news") {
      if (!apiKey) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              error: "NEWSDATA_API_KEY not set",
              setup: "Get a free key at newsdata.io and add to .env",
              fallback: "Using GoogleSearch tool directly is recommended" 
            }) 
          }]
        };
      }

      const timeframeMap = { breaking: "1", today: "24", week: "168" };
      const hours = timeframeMap[args.recency || "today"];
      const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(args.query)}&timeframe=${hours}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      try {
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (PolymarketBot/1.0)' }
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`NewsData API error (${response.status}): ${text.slice(0, 100)}`);
        }
        const data = await response.json();
        
        const articles = (data.results || []).map(a => {
          const domain = new URL(a.link).hostname.replace('www.', '');
          const tierInfo = getSourceTier(domain);
          return {
            title: a.title,
            source_domain: domain,
            tier: tierInfo.tier,
            reliability_score: tierInfo.reliability,
            published_at: a.pubDate,
            url: a.link,
            summary: a.description
          };
        });

        articles.sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return new Date(b.published_at) - new Date(a.published_at);
        });

        return { content: [{ type: "text", text: JSON.stringify(articles, null, 2) }] };
      } finally {
        clearTimeout(timeoutId);
      }

    } else if (name === "get_prediction_market_consensus") {
      const url = `https://www.metaculus.com/api2/questions/?search=${encodeURIComponent(args.question)}&limit=5`;
      const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (PolymarketBot/1.0)' }
      });
      if (!response.ok) {
          const text = await response.text();
          throw new Error(`Metaculus API error (${response.status}): ${text.slice(0, 100)}`);
      }
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ matched: false, reason: "No results found" }) }] };
      }

      const topResult = data.results[0];
      
      // Jaccard Similarity Implementation
      const tokenize = (str) => new Set(str.toLowerCase().match(/\w+/g));
      const s1 = tokenize(args.question);
      const s2 = tokenize(topResult.title);
      const intersection = new Set([...s1].filter(x => s2.has(x)));
      const union = new Set([...s1, ...s2]);
      const similarity = intersection.size / union.size;

      if (similarity < 0.30) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              matched: false, 
              reason: "no sufficiently similar question found",
              top_result_title: topResult.title,
              top_result_similarity: similarity 
            }) 
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            matched: true,
            question_title: topResult.title,
            metaculus_url: `https://www.metaculus.com${topResult.page_url}`,
            resolution_date: topResult.scheduled_resolve_time,
            community_prediction: topResult.community_prediction?.full?.q2,
            forecaster_count: topResult.number_of_forecasters,
            similarity_score: similarity,
            warning: "only use if forecaster_count > 50"
          }, null, 2)
        }]
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
