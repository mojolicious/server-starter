'use strict';

const t = require('tap');
const fetch = require('node-fetch');
const net = require('net');
const starter = require('..');

t.test('Start and stop a server', async t => {
  const server = await starter.newServer();
  t.equal(server.pid, null, 'not started');
  await server.launch('node', ['test/support/server_port.js', server.port], { avoidFdPassing: true });
  t.equal(typeof server.pid, 'number', 'started');
  const url = server.url();
  t.equal(typeof server.port, 'number', 'port assigned');

  const res = await fetch(url);
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid, null, 'stopped');

  let err;
  try { await fetch(url); } catch (e) { err = e; }
  t.ok(err, 'request failed');
  t.equal(err.errno, 'ECONNREFUSED', 'right error');
});

t.test('Do it again', async t => {
  const server = await starter.newServer();
  t.equal(server.pid, null, 'not started');
  await server.launch('node', ['test/support/server_port.js', server.port], { avoidFdPassing: true });
  t.equal(typeof server.pid, 'number', 'started');

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid, null, 'stopped');
});

t.test('Slow server', async t => {
  const server = await starter.newServer();
  t.equal(server.pid, null, 'not started');
  await server.launch('node', ['test/support/server_port.js', server.port, 1000], { avoidFdPassing: true });
  t.equal(typeof server.pid, 'number', 'started');

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid, null, 'stopped');
});

t.test('Slow server, with wrong (too small) timeout', async t => {
  const server = await starter.newServer();
  t.equal(server.pid, null, 'not started');

  let launchErr;
  try {
    await server.launch('node', ['test/support/server_port.js', server.port, 3000], { connectTimeout: 500, avoidFdPassing: true });
  } catch (e) { launchErr = e; }
  t.ok(launchErr, 'request failed');

  t.equal(typeof server.pid, 'number', 'started');

  let fetchErr;
  try { await fetch(server.url()); } catch (e) { fetchErr = e; }
  t.ok(fetchErr, 'request failed');
  t.equal(fetchErr.errno, 'ECONNREFUSED', 'right error');

  await server.close();
  t.equal(server.pid, null, 'stopped');
});

t.test('Use a specific port', async t => {
  const port = await getPort();
  const server = await starter.newServer(port);
  t.equal(server.pid, null, 'not started');
  await server.launch('node', ['test/support/server_port.js', server.port], { avoidFdPassing: true });
  t.equal(typeof server.pid, 'number', 'started');
  t.equal(server.port, port, 'right port');

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid, null, 'stopped');
});

function getPort () {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      resolve(srv.address().port);
      srv.close();
    });
  });
}
