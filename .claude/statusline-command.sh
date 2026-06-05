#!/usr/bin/env bash
input=$(cat)

# Git branch (skip optional locks to avoid conflicts)
git_branch=$(git -C "$(echo "$input" | jq -r '.workspace.current_dir')" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)

# Context window tokens
used_tokens=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // empty')
context_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Build output
parts=()

if [ -n "$git_branch" ]; then
    parts+=("$(printf '\033[0;36m\xee\x82\xa0 %s\033[0m' "$git_branch")")
fi

if [ -n "$used_tokens" ] && [ -n "$context_size" ]; then
    if [ -n "$used_pct" ]; then
        parts+=("$(printf '\033[0;33mCtx: %s/%s (%.0f%%)\033[0m' "$used_tokens" "$context_size" "$used_pct")")
    else
        parts+=("$(printf '\033[0;33mCtx: %s/%s\033[0m' "$used_tokens" "$context_size")")
    fi
elif [ -n "$used_tokens" ]; then
    parts+=("$(printf '\033[0;33mCtx: %s tokens\033[0m' "$used_tokens")")
fi

# Join parts with separator
output=""
for i in "${!parts[@]}"; do
    if [ $i -eq 0 ]; then
        output="${parts[$i]}"
    else
        output="$output $(printf '\033[0;37m|\033[0m') ${parts[$i]}"
    fi
done

printf "%s" "$output"
