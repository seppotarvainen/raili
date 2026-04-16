# LSP Technical Notes

## Bug Fixes (Latest Release)

### Approval Block Parsing
Fixed parser to correctly handle approval blocks. Previously extracted non-state values like `true` from `multiline: true`. Now only `PASSED` and `FAILED` are treated as state references.

### Diagnostic Position
Fixed line/column conversion. LSP protocol uses 0-indexed positions while parser uses 1-indexed. Errors now appear at exact correct lines.

## Implementation

Located in `packages/lsp/src/`:

- `lsp_server.ts` - LSP server entry point
- `lsp_workflowParser.ts` - YAML parser for state extraction
- `lsp_workflowDocument.ts` - Document model
- `protocol_*.ts` - LSP handlers (definition, references, hover, diagnostics, rename)

## Binary

Executable: `packages/lsp/bin/lsp.js`

Installed globally as `raili-lsp` when package installed with `npm install -g raili`.

## Test Coverage

- 31 LSP tests (all passing)
- 752 CLI tests (all passing)
- Coverage: 80%+ statements, 73%+ branches

Run tests:
```bash
npm run test:lsp      # LSP tests only
npm test              # Full test suite
```

## Limitations

LSP v1 operates on single workflow.yaml files. Cross-file navigation (groups, embeds, registries) deferred to v2.

No AST - uses line/column offset matching with regex for position tracking.

## Performance

- No measurable impact on IDE
- Suitable for workflows up to 500 states
- Larger workflows may see parsing delay

