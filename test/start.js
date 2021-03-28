'use strict';

const t = require('tap');
const fetch = require('node-fetch');
const starter = require('..');

t.test('Start and stop a server', async t => {
  const server = await starter.newServer();
  t.equal(server.pid, null, 'not started');
  await server.launch('node', ['test/support/server.js']);
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
  await server.launch('node', ['test/support/server.js']);
  t.equal(typeof server.pid, 'number', 'started');

  const res = await fetch(server.url());
  t.equal(res.ok, true, '2xx code');
  t.equal(res.headers.get('Content-Type'), 'text/plain', 'right "Content-Type" header');
  const buffer = await res.buffer();
  t.equal(buffer.toString('utf8'), 'Hello World!', 'right content');

  await server.close();
  t.equal(server.pid, null, 'stopped');
});
