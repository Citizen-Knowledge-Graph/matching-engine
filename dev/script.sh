#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${SCRIPT_DIR}/requirement-profiles/"
REPO_URL=https://github.com/Citizen-Knowledge-Graph/requirement-profiles

if [ -d "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
  echo "Updating the repo"
  git -C "$REPO_DIR" pull
else
  echo "Cloning the repo"
  git clone "$REPO_URL" "$REPO_DIR"
fi
