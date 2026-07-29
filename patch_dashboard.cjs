const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const replacements = [
  "unsubSettings =",
  "unsubCampaigns =",
  "unsubNotices =",
  "unsubUsers =",
  "unsubWelfare =",
  "unsubContribs =",
  "unsubTotal ="
];

for (const rep of replacements) {
  const regex = new RegExp(`const ${rep} onSnapshot\\(([^,]+), \\(snap\\) => \\{([\\s\\S]*?)\\}\\);`, "g");
  content = content.replace(regex, `const ${rep} onSnapshot($1, (snap) => {$2}, (err) => console.error("Dashboard error on ${rep}", err));`);
}

fs.writeFileSync('src/pages/Dashboard.tsx', content);
