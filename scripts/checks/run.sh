#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

changed_files=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    changed_files="$(git diff --name-only --diff-filter=ACMR @{u}...HEAD || true)"
  else
    changed_files="$(git diff --name-only --diff-filter=ACMR HEAD || true)"
  fi
fi

run_all=false
if [ -z "$changed_files" ]; then
  run_all=true
fi

has_frontend_changes=false
has_backend_changes=false
backend_files=()

if [ "$run_all" = false ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue

    if [[ "$file" == src/supabase/functions/* ]]; then
      if [ -f "$file" ] && [[ "$file" == *.ts || "$file" == *.tsx ]]; then
        backend_files+=("$file")
      fi
      has_backend_changes=true
      continue
    fi

    case "$file" in
      src/*|shared/*|local-engine/*|index.html|vite.config.ts|package.json|package-lock.json|tsconfig.json|eslint.config.*|.prettierrc.*|prettier.config.*|vitest.config.*)
        has_frontend_changes=true
        ;;
    esac
  done <<< "$changed_files"
else
  has_frontend_changes=true
  if [ -d "src/supabase/functions" ]; then
    has_backend_changes=true
  fi
fi

echo "Running quality checks..."

if [ "$has_frontend_changes" = true ]; then
  echo "\n[Frontend] format:check"
  npm run format:check

  echo "\n[Frontend] lint"
  npm run lint

  echo "\n[Frontend] typecheck"
  npm run typecheck

  echo "\n[Frontend] test:run"
  npm run test:run

  echo "\n[Frontend] project rules"
  npm run rules:check
fi

echo "\n[Frontend] build (always)"
npm run build

echo "\n[Local Engine] build (always)"
npm run build:engine

if [ "$has_backend_changes" = true ]; then
  if [ ${#backend_files[@]} -eq 0 ]; then
    # Fallback to entire backend folder when running all
    backend_files=("src/supabase/functions")
  fi
  echo "\n[Backend] deno fmt --check"
  deno fmt --check "${backend_files[@]}"

  echo "\n[Backend] deno lint"
  deno lint "${backend_files[@]}"
fi

echo "\nAll checks passed."
