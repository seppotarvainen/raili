#!/usr/bin/env node

const { execSync } = require('child_process');
const MAX_LINES = 500;  // adjust as needed

try {
    const output = execSync('npx cloc src/ --by-file --json', { encoding: 'utf8' });
    const data = JSON.parse(output);

    let filesExceeded = [];

    Object.entries(data)
        .filter(([filename]) => filename !== 'SUM')
        .forEach(([filename, stats]) => {
        if (stats.code && stats.code > MAX_LINES) {
            filesExceeded.push({ filename, lines: stats.code });
        }
    });

    if (filesExceeded.length > 0) {
        console.error('❌ Files exceed the line limit:');
        filesExceeded.forEach(({ filename, lines }) => {
            console.error(`  ${filename}: ${lines} lines (max: ${MAX_LINES})`);
        });
        process.exit(1);
    }

    console.log(`✅ All files are within the ${MAX_LINES} line limit`);
    process.exit(0);
} catch (error) {
    console.error('Error running cloc:', error.message);
    process.exit(1);
}