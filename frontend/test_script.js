const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const token = env.split('NEXT_PUBLIC_TOKEN=')[1].split('\n')[0].replace(/\"/g, '').replace(/\r/g, '');
fetch('http://127.0.0.1:8000/api/v1/hr/staff/?page_size=200&status=active', {
  headers: { 'Authorization': 'Bearer ' + token }
}).then(res => res.json()).then(data => {
  console.log(JSON.stringify(data.results[0], null, 2));
}).catch(console.error);
