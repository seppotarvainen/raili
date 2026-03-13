#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'documentation');
const outputFile = path.join(__dirname, '..', 'src', 'cli', 'generated-docs.ts');

// Read markdown files from both root and subdirectories
const usage = {};
const sections = {};

// Process root-level files (feature sections)
const rootFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

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

// Generate TypeScript file
const helpTopics = Object.entries(sections)
  .map(entry => {
    const key = entry[0];
    const help = entry[1].help;
    const escaped = help.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const usageHelp = Object.entries(usage)
  .map(entry => {
    const key = entry[0];
    const help = entry[1].help;
    const escaped = help.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const docsSections = Object.entries(sections)
  .map(entry => {
    const key = entry[0];
    const docs = entry[1].docs;
    const escaped = docs.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const usageDocs = Object.entries(usage)
  .map(entry => {
    const key = entry[0];
    const docs = entry[1].docs;
    const escaped = docs.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const availableTopics = Object.keys(sections);
const availableSections = Object.keys(sections);
const availableUsage = Object.keys(usage);

const output = `// AUTO-GENERATED FILE: Do not edit manually
// Generated from documentation/ markdown files at build time
// Run: npm run build:docs

export const HELP_TOPICS: Record<string, string> = {
${helpTopics}
};

export const USAGE_HELP: Record<string, string> = {
${usageHelp}
};

export const DOCS_SECTIONS: Record<string, string> = {
${docsSections}
};

export const USAGE_DOCS: Record<string, string> = {
${usageDocs}
};

export const AVAILABLE_TOPICS = [${availableTopics.map(t => `'${t}'`).join(', ')}];
export const AVAILABLE_SECTIONS = [${availableSections.map(s => `'${s}'`).join(', ')}];
export const AVAILABLE_USAGE = [${availableUsage.map(u => `'${u}'`).join(', ')}];
`;

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`✓ Generated documentation from markdown files`);
console.log(`✓ Output: ${outputFile}`);
console.log(`✓ Feature sections: ${Object.keys(sections).join(', ')}`);
console.log(`✓ Usage guides: ${Object.keys(usage).join(', ')}`);

