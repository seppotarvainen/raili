#!/usr/bin/env node
// Lightweight shim to start the LSP server from stdio. This delegates to dist/lsp_index.runFromStdio.
const path = require('path');
try {
  const pkg = require(path.join(__dirname, '../dist/lsp_index'));
  if (pkg && typeof pkg.runFromStdio === 'function') {
    pkg.runFromStdio();
  } else {
    // eslint-disable-next-line no-console
    console.error('runFromStdio not available');
    process.exit(1);
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to start raili-lsp:', e && e.message ? e.message : e);
  process.exit(1);
}
