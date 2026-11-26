#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is required. Install Node.js 20 or newer, then run this again.'
  read '?Press Return to close.'
  exit 1
fi
node server.mjs --open
