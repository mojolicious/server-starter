'use strict';

const t = require('tap');
const fetch = require('node-fetch');
const starter = require('..');

t.test('Start and stop a server, no fd passing allowed', async t => {
  const server = await starter.newServer();
  t.equal(server.pid(), null, 'not started');
  process.env.TEST_SERVER_STARTER_PORT = server.port;
  await server.launch('node', ['test/support/server.js'], { fdPassingAllowed: false });
  t.equal(typeof server.pid(), 'number', 'started');
  const url = server.url();

  const res = await fetch(url);
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid(), null, 'stopped');

  let err;
  try { await fetch(url); } catch (e) { err = e; }
  t.ok(err, 'request failed');
  t.equal(err.errno, 'ECONNREFUSED', 'right error');
});

t.test('Start and stop a server, using fd passing when available', async t => {
  const server = await starter.newServer();
  t.equal(server.pid(), null, 'not started');
  process.env.TEST_SERVER_STARTER_PORT = process.platform === 'win32' ? server.port : undefined;
  await server.launch('node', ['test/support/server.js'], { fdPassingAllowed: true });
  t.equal(typeof server.pid(), 'number', 'started');
  const url = server.url();

  const res = await fetch(url);
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid(), null, 'stopped');

  let err;
  try { await fetch(url); } catch (e) { err = e; }
  t.ok(err, 'request failed');
  t.equal(err.errno, 'ECONNREFUSED', 'right error');
});



t.test('Slow server, no fd passing allowed', async t => {
  const server = await starter.newServer();
  process.env.TEST_SERVER_STARTER_PORT = server.port;
  await server.launch('node', ['test/support/slow_server.js', 1000], { fdPassingAllowed: false });

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code received from slow server');

  await server.close();
  t.equal(server.pid(), null, 'slow server stopped');
});

t.test('Slow server, using fd passing when available', async t => {
  const server = await starter.newServer();
  process.env.TEST_SERVER_STARTER_PORT = process.platform === 'win32' ? server.port : undefined;
  await server.launch('node', ['test/support/slow_server.js', 1000], { fdPassingAllowed: false });

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code received from slow server');

  await server.close();
  t.equal(server.pid(), null, 'slow server stopped');
});

t.test('Unresponsive server (too slow), no fd passing allowed', async t => {
  const server = await starter.newServer();
  process.env.TEST_SERVER_STARTER_PORT = server.port;
  await server.launch('node', ['test/support/slow_server.js', 1500],
    { fdPassingAllowed: false, connectTimeout: 1000 })
    .catch((err) => {
      t.equal(err.code, 'ECONNREFUSED', 'right error');
    });
  await server.close();
  t.equal(server.pid(), null, 'slow server stopped');
});

t.test('Unresponsive server (too slow), using fd passing when available', async t => {
  const server = await starter.newServer();
  process.env.TEST_SERVER_STARTER_PORT = process.platform === 'win32' ? server.port : undefined;
  await server.launch('node', ['test/support/slow_server.js', 1500],
    { fdPassingAllowed: false, connectTimeout: 1000 })
    .catch((err) => {
      t.equal(err.code, 'ECONNREFUSED', 'right error');
    });
  await server.close();
  t.equal(server.pid(), null, 'slow server stopped');
});

t.test('Fixed port not available / available cases, without allowing fd passing', async t => {
  const dummyServer = await starter.newServer();
  const port = dummyServer.port;
  t.equal(dummyServer.pid(), null, 'dummy server process not used');
  let server = await starter.newServer();
  process.env.TEST_SERVER_STARTER_PORT = port; // port is the wrong (not available) port
  try {
    await server.launch('node', ['test/support/server.js'],
      { fdPassingAllowed: false, connectTimeout: 100, stderr: false });
  } catch (err) {
    t.equal(err.code, 'ECONNREFUSED', 'right error, server cannot listen');
  }
  t.equal(server.pid(), null, 'server with port already in use did never start');

  await dummyServer._srv.close();
  // now port can be used. (OSs avoid reusing recently liberated ports for a long while)
  server = await starter.newServer(port);
  await server.launch('node', ['test/support/server.js'], { fdPassingAllowed: false });
  t.equal(typeof server.pid(), 'number', 'server with fixed port started');

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid(), null, 'server with fixed port stopped');
});
