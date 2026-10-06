const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'dist', 'settings.json');
const target = process.argv[2];

if (!target) {
    console.error('Usage: node scripts/dumpKey.js <key>');
    console.error('  Use "commands" to list command keys, or "commands.<name>" for a sub-entry.');
    process.exit(1);
}

const raw = fs.readFileSync(settingsPath, 'utf8');
const settings = JSON.parse(raw);

function findLine(key, afterKey) {
    const lines = raw.split(/\r?\n/);
    let start = 0;
    if (afterKey) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('"' + afterKey + '":')) {
                start = i + 1;
                break;
            }
        }
    }
    for (let i = start; i < lines.length; i++) {
        if (lines[i].trim().startsWith('"' + key + '":')) return i + 1;
    }
    return -1;
}

if (target === 'commands') {
    console.log('=== commands @ line ' + findLine('commands') + ' ===');
    console.log('command keys (' + Object.keys(settings.commands).length + '):');
    console.log(JSON.stringify(Object.keys(settings.commands), null, 2));
} else if (target.startsWith('commands.')) {
    const sub = target.slice('commands.'.length);
    if (settings.commands && settings.commands[sub]) {
        console.log('=== commands.' + sub + ' @ line ' + findLine(sub, 'commands') + ' ===');
        console.log(JSON.stringify(settings.commands[sub], null, 2));
    } else {
        console.error('Unknown command: ' + sub);
        process.exit(1);
    }
} else {
    if (settings[target] !== undefined) {
        console.log('=== ' + target + ' @ line ' + findLine(target) + ' ===');
        console.log(JSON.stringify(settings[target], null, 2));
    } else {
        console.error('Unknown key: ' + target);
        process.exit(1);
    }
}