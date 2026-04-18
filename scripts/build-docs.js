#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'documentation');
const outputFile = path.join(__dirname, '..', 'src', 'cli', 'generatedDocs.json');

// Read markdown files from both root and subdirectories
const usage = {};
const sections = {};

// Process root-level files (excluding certain ones)
const excludeNames = new Set(['architecture', 'lsp']);
const rootFiles = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.md'))
    .map(d => d.name)
    .filter(name => !excludeNames.has(name.replace(/\.md$/, '')));

rootFiles.forEach(file => {
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
  const lines = content.split('\n');

  // Find title (first # heading)
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^# /, '').trim() : file.replace('.md', '');

  // Extract blockquote (first consecutive > lines)
  let blockquoteEnd = -1;
  let blockquoteStart = -1;
  const helpLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('>')) {
      if (blockquoteStart === -1) blockquoteStart = i;
      helpLines.push(lines[i].replace(/^> ?/, ''));
    } else if (blockquoteStart !== -1 && !lines[i].startsWith('>')) {
      blockquoteEnd = i;
      break;
    }
  }

  const help = helpLines.join('\n').trim();

  // For docs: use the entire file content (title + help + rest)
  const docsContent = lines.join('\n').trim();

  const topicKey = file.replace('.md', '');
  sections[topicKey] = {
    help,
    docs: docsContent
  };
});

// Process usage subdirectory
const usageDir = path.join(docsDir, 'usage');
if (fs.existsSync(usageDir)) {
  const usageFiles = fs.readdirSync(usageDir).filter(f => f.endsWith('.md'));

  usageFiles.forEach(file => {
    const content = fs.readFileSync(path.join(usageDir, file), 'utf-8');
    const lines = content.split('\n');

    // Find title (first # heading)
    const titleLine = lines.find(l => l.startsWith('# '));
    const title = titleLine ? titleLine.replace(/^# /, '').trim() : file.replace('.md', '');

    // Extract blockquote (first consecutive > lines)
    let blockquoteEnd = -1;
    let blockquoteStart = -1;
    const helpLines = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('>')) {
        if (blockquoteStart === -1) blockquoteStart = i;
        helpLines.push(lines[i].replace(/^> ?/, ''));
      } else if (blockquoteStart !== -1 && !lines[i].startsWith('>')) {
        blockquoteEnd = i;
        break;
      }
    }

    const help = helpLines.join('\n').trim();

    // For docs: use the entire file content (title + help + rest)
    const docsContent = lines.join('\n').trim();

    const topicKey = file.replace('.md', '');
    usage[topicKey] = {
      help,
      docs: docsContent
    };
  });
}

// Generate JSON data file
const output = JSON.stringify({
  helpTopics: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.help])),
  usageHelp:  Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, v.help])),
  docsSections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.docs])),
  usageDocs:  Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, v.docs])),
  availableTopics: Object.keys(sections),
  availableSections: Object.keys(sections),
  availableUsage: Object.keys(usage),
}, null, 2);

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`✓ Generated documentation from markdown files`);
console.log(`✓ Output: ${outputFile}`);
console.log(`✓ Feature sections: ${Object.keys(sections).join(', ')}`);
console.log(`✓ Usage guides: ${Object.keys(usage).join(', ')}`);

