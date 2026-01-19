---
name: cleanup-temp
description: Remove temporary tmpclaude-* files from the project directory
allowed-tools: Bash(find:*)
---

# Clean Up Temporary Files

Removes all `tmpclaude-*` files that accumulate during Claude Code operations.

## Usage

Type `/cleanup-temp` or ask "clean up temp files"

## Command

```bash
find . -name "tmpclaude-*" -type f -delete
```

## Dry Run (preview what will be deleted)

```bash
find . -name "tmpclaude-*" -type f
```
