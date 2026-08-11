const fs = require('fs');
let c = fs.readFileSync('src/lib/sample-data.ts', 'utf8');
c = c.replace(/"mimeType":\s*"webm"/g, '"mimeType": "video/webm"');
c = c.replace(/"mimeType":\s*"mp4"/g, '"mimeType": "video/mp4"');
fs.writeFileSync('src/lib/sample-data.ts', c);
console.log('Fixed mimeTypes');
