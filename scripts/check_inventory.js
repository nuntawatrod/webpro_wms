import fetch from 'node-fetch';
(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/inventory');
    const data = await res.json();
    console.log(data.find(p => p.total_quantity === 0));
  } catch (e) {
    console.error('failed', e);
  }
})();
