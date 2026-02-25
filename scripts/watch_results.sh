#!/bin/bash

# Watch for results and copy to public folder
while true; do
  if [ -f "results/full_benchmark_results.json" ]; then
    cp results/full_benchmark_results.json public/results.json
    echo "$(date): Copied results ($(jq '.processed // 0' public/results.json 2>/dev/null || echo 0) processed)"
  fi
  sleep 10
done
