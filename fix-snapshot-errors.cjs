const fs = require('fs');

function patchFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/\(err\) => console\.error\(([^,]+), err\)/g, 
    `(err) => { if (err.code !== 'permission-denied') console.error($1, err); }`);
  fs.writeFileSync(filepath, content);
}

patchFile('src/pages/Dashboard.tsx');
patchFile('src/pages/AdminDashboard.tsx');
patchFile('src/components/NotificationBell.tsx');

console.log('Done.');
