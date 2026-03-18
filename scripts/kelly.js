#!/usr/bin/env node

/**
 * Purpose: CLI tool to calculate Polymarket Kelly position sizes
 * Usage: node scripts/kelly.js --p 0.70 --market 0.60 --portfolio 1000
 * Worked example: p=0.70, P=0.60, portfolio=$1000
 *   Full Kelly: (0.70-0.60)/(1-0.60) = 0.25
 *   Normal (0.25x): 6.25% = $62.50 (but capped at 5% = $50.00)
 */

function printHelp() {
    console.log(`
Kelly Calculator -- Polymarket
================================
Usage: node scripts/kelly.js --p <probability> --market <price> --portfolio <size> [--fee <fee>]

Arguments:
  --p           Your true probability estimate (0 to 1)
  --market      Current YES market price (0 to 1)
  --portfolio   Total portfolio size in USDC
  --fee         (Optional) Winning fee as fraction (default: 0.02)
  --help        Show this help message

Example:
  node scripts/kelly.js --p 0.70 --market 0.60 --portfolio 1000
    `);
}

const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        params[args[i].slice(2)] = args[i + 1];
        i++;
    }
}

if (params.help) {
    printHelp();
    process.exit(0);
}

const p = parseFloat(params.p);
const market = parseFloat(params.market);
const portfolio = parseFloat(params.portfolio);
const fee = parseFloat(params.fee || 0.02);

if (isNaN(p) || p <= 0 || p >= 1) {
    console.error("Error: --p must be between 0 and 1.");
    process.exit(1);
}

if (isNaN(market) || market <= 0 || market >= 1) {
    console.error("Error: --market must be between 0 and 1.");
    process.exit(1);
}

if (isNaN(portfolio) || portfolio <= 0) {
    console.error("Error: --portfolio must be greater than 0.");
    process.exit(1);
}

const rawEdge = p - market;
const afterFeeEdge = p - market - fee;
const fullKelly = (p - market) / (1 - market);

if (afterFeeEdge < 0.025) {
    console.log("No edge after fees.");
    console.log(`After-fee edge: ${(afterFeeEdge * 100).toFixed(2)}%`);
    console.log(`Minimum required: 2.50%`);
    console.log(`Raw edge: ${(rawEdge * 100).toFixed(2)}%`);
    console.log(`Market price: ${market.toFixed(2)}`);
    console.log(`Your probability: ${p.toFixed(2)}`);
    process.exit(0);
}

console.log(`
Kelly Calculator -- Polymarket
================================
Your probability:    ${p.toFixed(2)}
Market price:        ${market.toFixed(2)}
Raw edge:           +${rawEdge.toFixed(2)} (${(rawEdge * 100).toFixed(2)}%)
After-fee edge:     +${afterFeeEdge.toFixed(2)} (${(afterFeeEdge * 100).toFixed(2)}%)
Full Kelly:          ${fullKelly.toFixed(4)} (${(fullKelly * 100).toFixed(2)}%)
--------------------------------
Multiplier | Fraction | Position | Capped?
--------------------------------`);

[0.10, 0.25, 0.33].forEach(multiplier => {
    const fractional = fullKelly * multiplier;
    const isCapped = fractional > 0.05;
    const finalFraction = Math.min(fractional, 0.05);
    const position = finalFraction * portfolio;

    console.log(`${multiplier.toFixed(2)}x      | ${(fractional * 100).toFixed(2)}%    | $${position.toFixed(2)}   | ${isCapped ? 'Yes' : 'No'}`);
});

console.log(`--------------------------------
Recommended: 0.25x = $${(Math.min(fullKelly * 0.25, 0.05) * portfolio).toFixed(2)} (normal conditions)
================================
`);
