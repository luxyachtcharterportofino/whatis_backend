#!/bin/zsh
cd "$(dirname "$0")"
export NODE_OPTIONS=
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
node server.js
