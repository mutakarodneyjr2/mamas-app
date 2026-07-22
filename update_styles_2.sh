#!/bin/bash
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/bg-green-100/bg-teal-50/g' \
  -e 's/text-green-800/text-mamas-success/g' \
  -e 's/bg-gray-100/bg-slate-100/g' \
  -e 's/text-gray-800/text-slate-700/g' \
  -e 's/bg-yellow-100/bg-amber-50/g' \
  -e 's/text-yellow-800/text-amber-700/g' \
  -e 's/border-yellow-200/border-amber-200/g' \
  -e 's/text-blue-900/text-mamas-primary/g' \
  -e 's/text-blue-600/text-mamas-accent/g' \
  -e 's/bg-blue-600/bg-mamas-accent/g' \
  -e 's/text-blue-700/text-mamas-accent-hover/g' \
  -e 's/bg-blue-100/bg-amber-50/g' \
  -e 's/bg-red-50/bg-rose-50/g' \
  -e 's/text-red-700/text-rose-700/g' \
  -e 's/text-red-500/text-rose-500/g' \
  -e 's/border-red-500/border-rose-500/g' \
  {} +
