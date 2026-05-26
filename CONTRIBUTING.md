# Contributing to Raili

This project is source-available. **I'm not accepting pull requests**, but I very much welcome bug reports, feature requests, and feedback.

## Reporting Bugs

If you found something that doesn't work:

1. [Open a GitHub issue](https://github.com/seppotarvainen/raili/issues)
2. Include:
   - **What you were doing** — exact steps to reproduce
   - **What happened** — the error or unexpected behavior
   - **What should happen** — expected behavior
   - **Your environment:**
     - OS (macOS / Linux / Windows)
     - Node.js version (run `node --version`)
     - raili version (run `raili --version` or check `package.json`)
   - **Error logs** — paste any error messages or stack traces

Example:
```
Title: [BUG] raili run fails when agent output is empty

## Steps to reproduce
1. Create a workflow with an agent state
2. Configure agent to produce no output
3. Run `raili run`

## Expected behavior
Should handle empty agent output gracefully

## Actual behavior
Error: Cannot read property 'split' of undefined

## Environment
- OS: macOS 14.2
- Node.js: 22.12.0
- raili: 1.0.0

## Error log
[paste stack trace here]
```

## Suggesting Features or Improvements

Have an idea? [Open an issue](https://github.com/seppotarvainen/raili/issues) with the label `enhancement`:

- Describe the use case or problem you're trying to solve
- Explain your proposed solution
- Note any alternatives you've considered
- Share examples if helpful

