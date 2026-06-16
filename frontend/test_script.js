const fs = require('fs');
const path = require('path');
try {
  const token = fs.readFileSync(path.join(__dirname, 'token.txt'), 'utf8').trim();
  fetch('http://127.0.0.1:8001/api/v1/hr/staff/?page_size=200&status=active', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(res => res.json()).then(data => {
    console.log(JSON.stringify(data.results[0], null, 2));
  }).catch(console.error);
} catch (error) {
  console.error("Could not read token from backend/token.txt", error.message);
}
