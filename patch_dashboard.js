const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
content = content.replace(/onSnapshot\(([^,]+), \(snap\) => \{/g, 'onSnapshot($1, (snap) => {');
content = content.replace(/, \(snap\) => \{/g, ', (snap) => {');
// Wait, I'll just write a script to replace `});` of unsub with `}, (err) => console.error("Dashboard onSnapshot error:", err));`
