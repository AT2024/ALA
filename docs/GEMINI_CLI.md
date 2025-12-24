# Using Gemini CLI for Large Codebase Analysis

When analyzing large codebases or multiple files that exceed Claude's context limits, use Gemini CLI with its massive context window.

## Quick Reference

```bash
# Single file
gemini -p "@src/main.py Explain this file"

# Multiple files
gemini -p "@package.json @src/index.js Analyze dependencies"

# Entire directory
gemini -p "@src/ Summarize the architecture"

# Whole project
gemini -p "@./ Give me an overview"
# Or: gemini --all_files -p "Analyze the project"
```

## When to Use Gemini CLI

Use `gemini -p` when:
- Analyzing entire codebases or large directories
- Comparing multiple large files
- Need project-wide pattern/architecture understanding
- Files total more than 100KB
- Claude's context window is insufficient

## File Inclusion Syntax

Use `@` syntax with paths relative to current working directory:

| Syntax | Description |
|--------|-------------|
| `@file.ts` | Single file |
| `@src/` | Entire directory |
| `@src/ @tests/` | Multiple directories |
| `@./` | Current directory + subdirs |
| `--all_files` | All project files |

## Implementation Verification Examples

### Check Feature Implementation
```bash
gemini -p "@src/ @lib/ Has dark mode been implemented? Show relevant files"
```

### Verify Auth Implementation
```bash
gemini -p "@src/ @middleware/ Is JWT authentication implemented? List endpoints"
```

### Check Security Measures
```bash
gemini -p "@src/ @api/ Are SQL injection protections implemented?"
```

### Verify Test Coverage
```bash
gemini -p "@src/payment/ @tests/ Is payment module fully tested?"
```

## Important Notes

- Paths are relative to where you run `gemini` command
- No `--yolo` needed for read-only analysis
- Be specific about what you're looking for
- Gemini handles codebases that would overflow Claude's context
