import net from 'net';
import ServerStarter from '../lib/server-starter.js';
import {UserAgent} from '@mojojs/core';
import t from 'tap';

t.test('Start and stop a server', async t => {
  const server = await ServerStarter.newServer();
  t.equal(server.pid, null);
  await server.launch('node', ['test/support/server_fd.js']);
  t.equal(typeof server.pid, 'number');
  const url = server.url();
  t.equal(typeof server.port, 'number');
  const ua = new UserAgent({baseURL: url});

  const res = await ua.get('/');
  t.equal(res.isSuccess, true);
  t.equal(res.get('Content-Type'), 'text/plain');
  t.equal(await res.text(), 'Hello World!');

  const res2 = await ua.get('/');
  t.equal(res2.isSuccess, true);
  t.equal(res2.get('Content-Type'), 'text/plain');
  t.equal(await res2.text(), 'Hello World!');

  await server.close();
  t.equal(server.pid, null);

  let err;
  try {
    await ua.get('/');
  } catch (e) {
    err = e;
  }
  t.ok(err);
});

t.test('Do it again', async t => {
  const server = await ServerStarter.newServer();
  t.equal(server.pid, null);
  await server.launch('node', ['test/support/server_fd.js']);
  t.equal(typeof server.pid, 'number');
  const ua = new UserAgent({baseURL: server.url()});

  const res = await ua.get('/');
  t.equal(res.isSuccess, true);
  t.equal(res.get('Content-Type'), 'text/plain');
  t.equal(await res.text(), 'Hello World!');

  await server.close();
  t.equal(server.pid, null);
});

t.test('Use a specific port', async t => {
  const port = await getPort();
  const server = await ServerStarter.newServer(port);
  t.equal(server.pid, null);
  await server.launch('node', ['test/support/server_fd.js']);
  t.equal(typeof server.pid, 'number');
  t.equal(server.port, port);
  const ua = new UserAgent({baseURL: server.url()});

  const res = await ua.get('/');
  t.equal(res.isSuccess, true);
  t.equal(res.get('Content-Type'), 'text/plain');
  t.equal(await res.text(), 'Hello World!');

  await server.close();
  t.equal(server.pid, null);
});

function getPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      resolve(srv.address().port);
      srv.close();
    });
  });
}

t.test('Set env', async t => {
  const server = await ServerStarter.newServer();
  t.equal(server.pid, null);
  await server.launch('node', ['test/support/server_fd.js'], {env: {...process.env, test: 'value'}});
  t.equal(typeof server.pid, 'number');
  const ua = new UserAgent({baseURL: server.url()});

  const res = await ua.get('/');
  t.equal(res.isSuccess, true);
  t.equal(JSON.parse(res.get('X-Env')).test, 'value');

  await server.close();
  t.equal(server.pid, null);
});
