const fs = require('fs');
const dbPath = 'D:/Projelerim/automania-next/.data/users/user-c2fsawh0yw5yaxnldmvumjvaz21hawwuy29t-db.json';
const raw = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(raw);

console.log('KEYS:', Object.keys(data));
console.log('Folders:', data.folders ? data.folders.length : 0);
console.log('Mockups:', data.mockups ? data.mockups.length : 0);
console.log('Designs:', data.designs ? data.designs.length : 0);

if (data.mockups) {
  data.mockups.forEach(m => {
    console.log('MOCKUP:', m.id, m.name, 'folderId:', m.folderId, 'src type:', m.src ? m.src.substring(0, 30) : 'null');
  });
}
