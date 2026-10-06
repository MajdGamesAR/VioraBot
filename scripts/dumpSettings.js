const path = require('path');
const fs = require('fs');

const settingsPath = path.join(__dirname, '..', 'dist', 'settings.json');
const raw = fs.readFileSync(settingsPath, 'utf8');
const lines = raw.split(/\r?\n/);

let s;
try {
  s = JSON.parse(raw);
} catch (e) {
  console.error('PARSE ERROR:', e.message);
  process.exit(1);
}

function findLine(key) {
  const re = new RegExp('^\\s*"' + key + '"\\s*:');
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return -1;
}

console.log('=== commands keys ===');
console.log(Object.keys(s.commands).join(', '));

for (const key of ['automod', 'autoReply', 'apply', 'welcome', 'welcomeGoodbye', 'leveling']) {
  const ln = findLine(key);
  console.log(`\n=== ${key} @ line ${ln} ===`);
  console.log(JSON.stringify(s[key], null, 2));
}

const firstCmdKey = Object.keys(s.commands)[0];
console.log(`\n=== commands.${firstCmdKey} @ line ${findLine(firstCmdKey)} ===`);
console.log(JSON.stringify(s.commands[firstCmdKey], null, 2));