#!/usr/bin/env bash
set -euo pipefail
if ! curl -fsS http://localhost:8501/_stcore/health >/dev/null 2>&1; then
  nohup python -m streamlit run app.py --server.address 0.0.0.0 > /tmp/sky-sailer-streamlit.log 2>&1 &
fi
