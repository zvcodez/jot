#!/bin/zsh
# Double-click to open Terminal in this project folder and start Claude Code.
# Make sure claude is found even when launched from Finder (non-login shell).
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")"
clear
echo "📂 $(basename "$(pwd)")  —  starting Claude Code…"
echo
if ! command -v claude >/dev/null 2>&1; then
  echo "⚠️  Couʼt find the 'claude' command. Open a normal Terminal and run 'claude' once to check it's installed."
  echo
  exec zsh -il
fi
exec claude
