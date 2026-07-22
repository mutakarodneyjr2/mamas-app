#!/bin/bash
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/bg-gray-900/bg-mamas-primary/g' \
  -e 's/text-gray-900/text-mamas-text/g' \
  -e 's/border-gray-900/border-mamas-primary/g' \
  -e 's/ring-gray-900/ring-mamas-primary/g' \
  -e 's/hover:bg-gray-800/hover:bg-mamas-primary-hover/g' \
  -e 's/hover:text-gray-900/hover:text-mamas-primary/g' \
  -e 's/text-indigo-600/text-mamas-accent/g' \
  -e 's/hover:text-indigo-900/hover:text-mamas-accent-hover/g' \
  -e 's/bg-indigo-600/bg-mamas-accent/g' \
  -e 's/hover:bg-indigo-700/hover:bg-mamas-accent-hover/g' \
  -e 's/text-green-600/text-mamas-success/g' \
  -e 's/bg-green-600/bg-mamas-success/g' \
  -e 's/hover:bg-green-700/hover:opacity-90/g' \
  -e 's/bg-gray-50/bg-mamas-bg/g' \
  -e 's/text-gray-600/text-mamas-text-muted/g' \
  -e 's/text-gray-500/text-mamas-text-muted/g' \
  -e 's/border-gray-200/border-slate-200/g' \
  -e 's/bg-white/bg-mamas-card/g' \
  -e 's/text-red-600/text-mamas-danger/g' \
  -e 's/bg-red-600/bg-mamas-danger/g' \
  {} +
