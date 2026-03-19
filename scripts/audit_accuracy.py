#!/usr/bin/env python3
import json
import os
import statistics
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).parent.parent
OUTPUT_DIR = ROOT_DIR / "output"
PREDICTIONS_FILE = OUTPUT_DIR / "predictions.jsonl"
TRADES_FILE = OUTPUT_DIR / "trades.jsonl"
RESULTS_FILE = OUTPUT_DIR / "audit_results.json"

def calculate_brier_metrics():
    metrics = {
        "ensemble": [],
        "bayesian": [],
        "sentiment": [],
        "domain": []
    }
    
    if not PREDICTIONS_FILE.exists():
        return metrics
        
    with open(PREDICTIONS_FILE, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
                if record.get('status') != 'resolved' or record.get('actual_outcome') is None:
                    continue
                
                outcome = record['actual_outcome']
                
                # Ensemble (the main prediction)
                if record.get('predicted_p') is not None:
                    metrics["ensemble"].append((record['predicted_p'] - outcome) ** 2)
                
                # Path breakdowns
                ensemble = record.get('ensemble_breakdown')
                if ensemble:
                    if ensemble.get('bayesian') is not None:
                        metrics["bayesian"].append((ensemble['bayesian'] - outcome) ** 2)
                    if ensemble.get('sentiment') is not None:
                        metrics["sentiment"].append((ensemble['sentiment'] - outcome) ** 2)
                    if ensemble.get('domain') is not None:
                        metrics["domain"].append((ensemble['domain'] - outcome) ** 2)
            except Exception as e:
                print(f"Error parsing prediction line: {e}")
                
    return metrics

def calculate_rtt_metrics():
    rtt_data = {
        "total": [],
        "posting": [],
        "signing": [],
        "slippage": []
    }
    
    if not TRADES_FILE.exists():
        return rtt_data
        
    with open(TRADES_FILE, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
                telemetry = record.get('telemetry')
                if not telemetry:
                    continue
                
                if telemetry.get('total_latency_ms') is not None:
                    rtt_data["total"].append(telemetry['total_latency_ms'])
                if telemetry.get('api_posting_ms') is not None:
                    rtt_data["posting"].append(telemetry['api_posting_ms'])
                if telemetry.get('signing_ms') is not None:
                    rtt_data["signing"].append(telemetry['signing_ms'])
                if telemetry.get('slippage_check_ms') is not None:
                    rtt_data["slippage"].append(telemetry['slippage_check_ms'])
            except Exception as e:
                print(f"Error parsing trade line: {e}")
                
    return rtt_data

def main():
    print("Starting Performance Audit...")
    
    brier_metrics = calculate_brier_metrics()
    rtt_metrics = calculate_rtt_metrics()
    
    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0
    
    def p99(lst):
        if not lst: return 0.0
        lst_sorted = sorted(lst)
        idx = int(len(lst_sorted) * 0.99)
        return lst_sorted[min(idx, len(lst_sorted)-1)]

    results = {
        "avg_brier_ensemble": avg(brier_metrics["ensemble"]),
        "avg_brier_bayesian": avg(brier_metrics["bayesian"]),
        "avg_brier_sentiment": avg(brier_metrics["sentiment"]),
        "avg_brier_domain": avg(brier_metrics["domain"]),
        "avg_rtt_total_ms": avg(rtt_metrics["total"]),
        "avg_rtt_posting_ms": avg(rtt_metrics["posting"]),
        "p99_latency_ms": p99(rtt_metrics["total"]),
        "sample_counts": {
            "resolved_predictions": len(brier_metrics["ensemble"]),
            "ensemble_paths": len(brier_metrics["bayesian"]),
            "trades_logged": len(rtt_metrics["total"])
        }
    }
    
    # Save results
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(RESULTS_FILE, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Audit complete. Results saved to {RESULTS_FILE}")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
