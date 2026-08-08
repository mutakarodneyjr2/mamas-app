const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/body: JSON\.stringify\(\{\s*amount,\s*phoneNumber: requestData\.recipientPhoneNumber,\s*network,\s*reference: requestId,\s*metadata: \{\s*type: 'welfare',\s*requestId\s*\}\s*\}\)/g, 
"body: JSON.stringify({ type: 'welfare', documentId: requestId, note: 'Welfare Payout' })");

code = code.replace(/body: JSON\.stringify\(\{\s*amount,\s*phoneNumber: expenseData\.recipientPhoneNumber,\s*network,\s*reference: expenseId,\s*metadata: \{\s*type: 'expense',\s*expenseId\s*\}\s*\}\)/g, 
"body: JSON.stringify({ type: 'expense', documentId: expenseId, note: 'Expense Payout' })");

fs.writeFileSync('src/lib/services.ts', code);
console.log('Services patched');
