const { createClient } = require('redis');

(async () => {
  const client = createClient();

  //   client.on('error', (err) => console.log('Redis Client Error', err));

  await client.connect();

  let i = 0;
  while (1) {
    try {
      const value = await client.get('key');
      console.log(value);
    } catch (err) {
      console.error('bang bang ada error bang', err);
    } finally {
      i += 1;
      i %= Number.MAX_SAFE_INTEGER;
      console.log(i);
    }
  }
  await client.disconnect();
})();
