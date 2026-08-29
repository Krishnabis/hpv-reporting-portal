import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:5001/api/vaccine/monthly-report/status?month=2026-08&blockId=292');
  const data = await res.text();
  console.log(data);
}
test();
