/**
 * Polymarket MCP Server
 * Exposes: get_markets, get_orderbook, get_history
 * Install: cd mcp && npm install
 * APIs: gamma-api.polymarket.com, clob.polymarket.com, data-api.polymarket.com
 * Auth: set POLYMARKET_API_KEY env var for rate limit increases
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRADES_LOG_FILE = path.join(__dirname, '../output/trades.jsonl');

const server = new Server(
  {
    name: "polymarket",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Polymarket CLOB Client
let POLYMARKET_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
if (POLYMARKET_PRIVATE_KEY) {
  // If it's a 44-char base64 string, decode it to hex
  if (POLYMARKET_PRIVATE_KEY.length === 44 && !POLYMARKET_PRIVATE_KEY.startsWith('0x')) {
    try {
      const buf = Buffer.from(POLYMARKET_PRIVATE_KEY, 'base64');
      if (buf.length === 32) {
        POLYMARKET_PRIVATE_KEY = '0x' + buf.toString('hex');
      }
    } catch (e) {
      console.error("Base64 decoding failed, using raw private key:", e.message);
    }
  } else if (!POLYMARKET_PRIVATE_KEY.startsWith('0x') && POLYMARKET_PRIVATE_KEY.length === 64) {
    POLYMARKET_PRIVATE_KEY = '0x' + POLYMARKET_PRIVATE_KEY;
  }
}

const POLYMARKET_API_KEY = process.env.POLYMARKET_API_KEY;
const POLYMARKET_API_SECRET = process.env.POLYMARKET_API_SECRET;
const POLYMARKET_API_PASSPHRASE = process.env.POLYMARKET_API_PASSPHRASE;

let clobClient = null;
if (POLYMARKET_PRIVATE_KEY) {
  try {
    const signer = new Wallet(POLYMARKET_PRIVATE_KEY);
    
    // Heuristic: User often confuses secret/passphrase.
    // Secret is usually 64 hex chars.
    let secret = POLYMARKET_API_SECRET;
    let passphrase = POLYMARKET_API_PASSPHRASE;
    
    if (!secret && passphrase && passphrase.length === 64) {
      // User likely provided the secret in the passphrase field
      secret = passphrase;
      passphrase = ""; // Or some default if it's not set
    }

    clobClient = new ClobClient(
      "https://clob.polymarket.com",
      137,
      signer,
      {
        apiKey: POLYMARKET_API_KEY,
        secret: secret,
        passphrase: passphrase,
      },
      0, // Signature type: 0 = EOA
      signer.address // Funder address
    );
    console.error(`Polymarket CLOB Client initialized for ${signer.address}`);
  } catch (e) {
    console.error("Failed to initialize Polymarket CLOB Client:", e.message);
  }
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // ms

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const waitTime = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    lastRequestTime = Date.now();
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_markets",
        description: "Fetch active Polymarket markets with optional filtering and sorting.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Keyword search" },
            category: { type: "string", description: "e.g. 'politics', 'crypto'" },
            limit: { type: "number", description: "Default 20, max 100", default: 20 },
            sort_by: { type: "string", enum: ["volume", "liquidity", "end_date"], default: "volume" },
            min_liquidity: { type: "number", description: "Minimum open interest (liquidity) in USDC" },
            max_liquidity: { type: "number", description: "Maximum open interest (liquidity) in USDC" },
            active_only: { type: "boolean", default: true }
          }
        }
      },
      {
        name: "get_orderbook",
        description: "Fetch the live order book depth for a specific token ID.",
        inputSchema: {
          type: "object",
          properties: {
            token_id: { type: "string", description: "The token ID (YES or NO) to fetch the book for" }
          },
          required: ["token_id"]
        }
      },
      {
        name: "get_history",
        description: "Fetch historical price time-series for a market.",
        inputSchema: {
          type: "object",
          properties: {
            market_id: { type: "string", description: "The ID of the market" },
            interval: { type: "string", enum: ["1m", "5m", "1h", "1d"], default: "1h" },
            start_date: { type: "string", description: "ISO8601 start timestamp" },
            end_date: { type: "string", description: "ISO8601 end timestamp" }
          },
          required: ["market_id"]
        }
      },
      {
        name: "calculate_kelly",
        description: "Calculate recommended Kelly position sizing based on model probability and live order book.",
        inputSchema: {
          type: "object",
          properties: {
            probability: { type: "number", description: "Your estimated probability (0-1)" },
            token_id: { type: "string", description: "The token ID (YES or NO) to fetch the book for" },
            portfolio_size: { type: "number", description: "Total USDC portfolio size" },
            multiplier: { type: "number", enum: [0.1, 0.25, 0.33], default: 0.25, description: "Kelly fraction multiplier" }
          },
          required: ["probability", "token_id", "portfolio_size"]
        }
      },
      {
        name: "place_order",
        description: "Place a market order on Polymarket with a $50 Risk Shield.",
        inputSchema: {
          type: "object",
          properties: {
            token_id: { type: "string", description: "The token ID to trade" },
            price: { type: "number", description: "The limit price (cap for BUY, floor for SELL)" },
            amount_usdc: { type: "number", description: "Amount in USDC to spend/receive (max 50)" },
            side: { type: "string", enum: ["BUY", "SELL"], description: "Order side" }
          },
          required: ["token_id", "price", "amount_usdc", "side"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_markets") {
      const params = new URLSearchParams();
      if (args.query) params.append("q", args.query);
      if (args.category) params.append("tag", args.category);
      
      // If filtering by liquidity, we fetch more items to filter locally
      const fetchLimit = (args.min_liquidity !== undefined || args.max_liquidity !== undefined) ? 100 : Math.min(args.limit || 20, 100);
      params.append("limit", fetchLimit.toString());
      params.append("active", "true");
      params.append("closed", "false");
      params.append("order", "volume24hr");
      params.append("ascending", "false");
      
      const url = `https://gamma-api.polymarket.com/markets?${params.toString()}`;
      const response = await rateLimitedFetch(url);
      if (!response.ok) throw new Error(`Gamma API error: ${response.statusText}`);
      const data = await response.json();
      
      let markets = data.map(m => {
          let outcomePrices = [];
          try {
              outcomePrices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
          } catch (e) {
              outcomePrices = [0, 0];
          }

          return {
            id: m.id,
            question: m.question,
            category: m.category,
            yes_price: outcomePrices?.[0] ? parseFloat(outcomePrices[0]) : null,
            no_price: outcomePrices?.[1] ? parseFloat(outcomePrices[1]) : null,
            spread: outcomePrices ? Math.abs(parseFloat(outcomePrices[0]) + parseFloat(outcomePrices[1]) - 1) : null,
            volume_24h: parseFloat(m.volume24hr || 0),
            open_interest: parseFloat(m.liquidity || 0),
            end_date: m.endDate,
            resolution_source: m.resolutionSource,
            status: m.active ? "active" : "closed",
            clobTokenIds: typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds
          };
      });

      // Filter by liquidity locally
      if (args.min_liquidity !== undefined) {
          markets = markets.filter(m => m.open_interest >= args.min_liquidity);
      }
      if (args.max_liquidity !== undefined) {
          markets = markets.filter(m => m.open_interest <= args.max_liquidity);
      }

      // Respect the original limit after filtering
      if (args.limit) {
          markets = markets.slice(0, args.limit);
      }

      switch (args.sort_by) {
        case 'volume':
          markets.sort((a, b) => b.volume_24h - a.volume_24h);
          break;
        case 'liquidity':
          markets.sort((a, b) => b.open_interest - a.open_interest);
          break;
        case 'end_date':
          markets.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
          break;
      }
      
      return { content: [{ type: "text", text: JSON.stringify(markets, null, 2) }] };

    } else if (name === "get_orderbook") {
      const url = `https://clob.polymarket.com/book?token_id=${args.token_id}`;
      const response = await rateLimitedFetch(url);
      if (!response.ok) throw new Error(`CLOB API error: ${response.statusText}`);
      const data = await response.json();
      
      // Bids come in ascending order (lowest first), we want highest first
      const bids = (data.bids || []).map(b => ({ price: parseFloat(b.price), size: parseFloat(b.size) })).sort((a, b) => b.price - a.price);
      // Asks come in ascending order (lowest first), which is what we want
      const asks = (data.asks || []).map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) })).sort((a, b) => a.price - b.price);
      
      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;
      
      return { content: [{ type: "text", text: JSON.stringify({
        token_id: args.token_id,
        yes_price: bestBid, // Approximate
        no_price: 1 - bestAsk, // Approximate
        spread: Math.abs(bestAsk - bestBid),
        mid_price: (bestBid + bestAsk) / 2,
        bids,
        asks,
        total_bid_size: bids.reduce((acc, b) => acc + b.size, 0),
        total_ask_size: asks.reduce((acc, a) => acc + a.size, 0),
        last_trade_price: parseFloat(data.last_trade_price || 0),
        volume_24h: parseFloat(data.volume_24h || 0)
      }, null, 2) }] };

    } else if (name === "get_history") {
      const params = new URLSearchParams();
      params.append("market", args.market_id);
      params.append("interval", args.interval || "1h");
      if (args.start_date) params.append("startTs", Math.floor(new Date(args.start_date).getTime() / 1000).toString());
      if (args.end_date) params.append("endTs", Math.floor(new Date(args.end_date).getTime() / 1000).toString());
      
      const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
      const response = await rateLimitedFetch(url);
      
      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Data API Error: ${url} -> ${response.status} ${errBody}`);
        throw new Error(`Data API error: ${response.status}`);
      }
      
      const data = await response.json();
      const points = (data.history || []).map(p => ({
        timestamp: new Date(p.t * 1000).toISOString(),
        price: parseFloat(p.p),
      }));
      
      const lastPrice = points[points.length - 1]?.price || 0;
      const firstPrice = points[0]?.price || 0;
      const price7dChange = firstPrice !== 0 ? (lastPrice - firstPrice) / firstPrice : 0;
      
      // Basic volatility calculation (std dev of daily returns)
      let volatility = 0;
      if (points.length > 1) {
          const returns = [];
          for (let i = 1; i < points.length; i++) {
            if (points[i-1].price !== 0) {
              returns.push((points[i].price - points[i-1].price) / points[i-1].price);
            }
          }
          if (returns.length > 0) {
              const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
              const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
              volatility = Math.sqrt(variance);
          }
      }

      return { content: [{ type: "text", text: JSON.stringify({
        price_7d_change: price7dChange,
        price_volatility_7d: volatility,
        current_price: lastPrice,
        data_points: points.length,
        history: points
      }, null, 2) }] };
    } else if (name === "calculate_kelly") {
      const { probability: p, token_id, portfolio_size, multiplier = 0.25 } = args;
      
      const url = `https://clob.polymarket.com/book?token_id=${token_id}`;
      const response = await rateLimitedFetch(url);
      if (!response.ok) throw new Error(`CLOB API error: ${response.statusText}`);
      const data = await response.json();
      
      const asks = (data.asks || []).map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) })).sort((a, b) => a.price - b.price);
      
      if (asks.length === 0) {
        throw new Error("No sell orders available for this token");
      }
      
      const P = asks[0].price; // Execution price
      const rawEdge = p - P;
      const afterFeeEdge = rawEdge - 0.02;
      
      if (afterFeeEdge < 0.025) {
        return { content: [{ type: "text", text: JSON.stringify({
          error: "No edge after fees",
          entry_price: P,
          raw_edge: rawEdge,
          after_fee_edge: afterFeeEdge,
          status: "REJECTED"
        }, null, 2) }] };
      }
      
      // fullKelly = (p - P) / (1 - P)
      const fullKelly = (p - P) / (1 - P);
      let kellyFraction = fullKelly * multiplier;
      
      // Hard cap of 0.05 (5%)
      kellyFraction = Math.min(kellyFraction, 0.05);
      
      // Ensure it doesn't go negative if multiplier or something weird happens
      kellyFraction = Math.max(kellyFraction, 0);
      
      const suggestedAmount = portfolio_size * kellyFraction;
      
      return { content: [{ type: "text", text: JSON.stringify({
        suggested_amount_usdc: suggestedAmount,
        entry_price: P,
        raw_edge: rawEdge,
        after_fee_edge: afterFeeEdge,
        kelly_fraction: kellyFraction,
        full_kelly: fullKelly,
        status: "SUCCESS"
      }, null, 2) }] };
    } else if (name === "place_order") {
      const { token_id, price, amount_usdc, side } = args;
      const tStart = performance.now();
      const telemetry = {
        slippage_check_ms: 0,
        signing_ms: 0,
        api_posting_ms: 0,
        total_latency_ms: 0
      };

      const logTrade = async (status, result) => {
        telemetry.total_latency_ms = performance.now() - tStart;
        const tradeLog = {
          timestamp: new Date().toISOString(),
          token_id,
          side,
          amount_usdc,
          price,
          status,
          telemetry,
          ...result
        };
        try {
          await fs.appendFile(TRADES_LOG_FILE, JSON.stringify(tradeLog) + '\n');
        } catch (err) {
          console.error(`Failed to log trade to ${TRADES_LOG_FILE}:`, err.message);
        }
      };

      // Risk Shield
      if (amount_usdc > 50) {
        const errorMsg = `Risk Shield: Order amount ${amount_usdc} USDC exceeds hard cap of 50 USDC.`;
        await logTrade("REJECTED", { reason: errorMsg });
        throw new Error(errorMsg);
      }

      // Slippage Protection (Design mandated)
      const tSlippageStart = performance.now();
      try {
        const bookUrl = `https://clob.polymarket.com/book?token_id=${token_id}`;
        const bookResp = await rateLimitedFetch(bookUrl);
        if (bookResp.ok) {
          const bookData = await bookResp.json();
          const lastPrice = parseFloat(bookData.last_trade_price || 0);
          if (lastPrice > 0) {
            const slippage = side === "BUY" ? (price - lastPrice) / lastPrice : (lastPrice - price) / lastPrice;
            if (slippage > 0.02) {
              const errorMsg = `Risk Shield: Slippage too high (${(slippage * 100).toFixed(2)}%). Max 2%. Last price: ${lastPrice}`;
              telemetry.slippage_check_ms = performance.now() - tSlippageStart;
              await logTrade("REJECTED", { reason: errorMsg });
              throw new Error(errorMsg);
            }
          }
        }
      } catch (e) {
        console.error("Warning: Slippage check failed:", e.message);
        // Continue if API is down, we still have FOK protection
      } finally {
        if (telemetry.slippage_check_ms === 0) {
           telemetry.slippage_check_ms = performance.now() - tSlippageStart;
        }
      }

      if (!clobClient) {
        const errorMsg = "ClobClient not initialized. Check POLYMARKET_PRIVATE_KEY and API credentials in .env.";
        await logTrade("REJECTED", { reason: errorMsg });
        throw new Error(errorMsg);
      }

      const orderSide = side === "BUY" ? Side.BUY : Side.SELL;
      
      // BUY orders: $$$ Amount to buy, SELL orders: Shares to sell
      const orderAmount = side === "BUY" ? amount_usdc : amount_usdc / price;

      // Fetch tick size and negRisk if possible, or use reasonable defaults
      let tickSize, negRisk;
      try {
        tickSize = await clobClient.getTickSize(token_id);
        negRisk = await clobClient.getNegRisk(token_id);
      } catch (e) {
        console.error("Warning: Could not fetch market metadata, using defaults:", e.message);
        tickSize = "0.001";
        negRisk = true;
      }

      const tSigningStart = performance.now();
      const marketOrder = await clobClient.createMarketOrder({
        tokenID: token_id,
        amount: orderAmount,
        side: orderSide,
        price: price,
        orderType: OrderType.FOK
      }, { tickSize, negRisk });
      telemetry.signing_ms = performance.now() - tSigningStart;

      const tPostingStart = performance.now();
      const response = await clobClient.postOrder(marketOrder, OrderType.FOK);
      telemetry.api_posting_ms = performance.now() - tPostingStart;

      if (response && (response.success || response.status === "OK")) {
        const result = {
          order_id: response.orderID || response.hash,
          side,
          amount_usdc,
          price,
          response
        };
        await logTrade("SUCCESS", result);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "SUCCESS",
              ...result
            }, null, 2)
          }]
        };
      } else {
        const result = {
          reason: response?.errorMsg || "Unknown error",
          response
        };
        await logTrade("REJECTED", result);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "REJECTED",
              ...result
            }, null, 2)
          }]
        };
      }
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message, markets: [] }) }],
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
