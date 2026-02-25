#!/usr/bin/env python3
"""
GenLayer vs Polymarket Benchmark Dashboard
Serves results on localhost:5050
"""

import json
import os
from flask import Flask, render_template, jsonify
from datetime import datetime

app = Flask(__name__)

RESULTS_FILE = os.path.expanduser("~/genlayer-benchmark/results/benchmark_results.json")
MARKETS_FILE = os.path.expanduser("~/genlayer-benchmark/data/markets.json")

def load_json(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/results')
def get_results():
    results = load_json(RESULTS_FILE)
    markets = load_json(MARKETS_FILE)
    return jsonify({
        "results": results,
        "markets": markets,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/status')
def get_status():
    results = load_json(RESULTS_FILE)
    return jsonify({
        "status": results.get("status", "unknown"),
        "completed": results.get("completed", 0),
        "total": results.get("total_markets", 10),
        "metrics": results.get("metrics", {})
    })

if __name__ == '__main__':
    print("🚀 GenLayer Benchmark Dashboard starting on http://localhost:5050")
    app.run(host='0.0.0.0', port=5050, debug=True)
