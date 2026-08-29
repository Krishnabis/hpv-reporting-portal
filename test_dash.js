import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://localhost:5000/api/vaccine/dashboard');
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
}
run();
