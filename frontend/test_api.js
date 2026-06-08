const fs = require('fs');
const http = require('http');

const payload = JSON.stringify({
  class: 1,
  class_id: 1,
  section: 1,
  section_id: 1,
  attendance_date: "2026-06-03"
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 8002,
  path: '/api/v1/attendance/student-attendance/student-search/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    console.log('BODY:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(payload);
req.end();
