#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PREDICTIONS_FILE = path.join(ROOT_DIR, 'output', 'predictions.jsonl');

async function resolvePredictions() {
    console.log('Starting automated resolution...');
    
    let content;
    try {
        content = await fs.readFile(PREDICTIONS_FILE, 'utf-8');
    } catch (error) {
        console.error(`Error reading predictions file: ${error.message}`);
        process.exit(1);
    }

    const lines = content.trim().split('\n').filter(line => line.trim());
    const records = lines.map(line => JSON.parse(line));
    
    const pendingRecords = records.filter(r => r.status === 'pending');
    console.log(`Found ${pendingRecords.length} pending predictions.`);

    if (pendingRecords.length === 0) {
        console.log('No pending predictions to resolve.');
        return;
    }

    let resolvedCount = 0;
    let totalBrierScore = 0;
    let resolvedBrierCount = 0;

    for (const record of records) {
        if (record.status !== 'pending') {
            if (record.status === 'resolved' && record.brier_score !== null) {
                totalBrierScore += record.brier_score;
                resolvedBrierCount++;
            }
            continue;
        }

        try {
            const url = `https://gamma-api.polymarket.com/markets/${record.market_id}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.warn(`Failed to fetch market ${record.market_id}: ${response.statusText}`);
                continue;
            }

            const market = await response.json();
            
            if (market.closed === true) {
                let outcomePrices;
                try {
                    outcomePrices = typeof market.outcomePrices === 'string' 
                        ? JSON.parse(market.outcomePrices) 
                        : market.outcomePrices;
                } catch (e) {
                    console.warn(`Could not parse outcomePrices for market ${record.market_id}`);
                    continue;
                }

                if (outcomePrices && outcomePrices.length > 0) {
                    const actualOutcome = parseFloat(outcomePrices[0]);
                    const brierScore = Math.pow(record.predicted_p - actualOutcome, 2);
                    
                    record.status = 'resolved';
                    record.actual_outcome = actualOutcome;
                    record.brier_score = brierScore;
                    
                    resolvedCount++;
                    totalBrierScore += brierScore;
                    resolvedBrierCount++;
                    
                    console.log(`Resolved: "${record.question}" | Outcome: ${actualOutcome} | Brier: ${brierScore.toFixed(4)}`);
                }
            }
        } catch (error) {
            console.error(`Error resolving market ${record.market_id}: ${error.message}`);
        }
        
        // Rate limiting to avoid hitting Gamma API too hard
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Write updated records back
    const updatedContent = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(PREDICTIONS_FILE, updatedContent, 'utf-8');

    console.log('\nResolution Summary:');
    console.log(`-------------------`);
    console.log(`New resolutions:   ${resolvedCount}`);
    console.log(`Total resolved:    ${resolvedBrierCount}`);
    if (resolvedBrierCount > 0) {
        const avgBrier = totalBrierScore / resolvedBrierCount;
        console.log(`Average Brier:     ${avgBrier.toFixed(4)}`);
        console.log(`(Lower is better, 0.0 = perfect, 0.25 = random, 1.0 = always wrong)`);
    } else {
        console.log(`Average Brier:     N/A`);
    }
}

resolvePredictions().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
