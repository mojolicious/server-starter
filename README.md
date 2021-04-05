# server-starter [![](https://github.com/mojolicious/server-starter/workflows/test/badge.svg)](https://github.com/mojolicious/server-starter/actions)

  UNIX, MacOS and Windows platforms superdaemon with support for socket activation.

## Description

  This module exists to handle socket activation for TCP servers running in separate processes on different platforms. It is capable of
  assigning random ports to avoid race conditions when there are many services running in parallel on the same machine.
  As is common with large scale testing.
  
  On UNIX / MacOS platforms the superdaemon will create the listen socket and pass it to the managed process as `fd=3`, similar to how `systemd`
  handles socket activation. This also avoids any race conditions between spawning the managed process and sending the
  first request, since the listen socket is active the whole time.

  For Windows platforms, read also ```Launching servers / platforms without file descriptor pass support``` below.

```js
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
server.listen({ fd: 3 });
```

  All the web application has to do is use `fd=3` as its listen socket to accept new connections from.

```js
const starter = require('@mojolicious/server-starter');
const fetch = require('node-fetch');

(async () => {
  const server = await starter.newServer();
  await server.launch('node', ['server.js']);
  const url = server.url();

  const res = await fetch(url);
  const buffer = await res.buffer();
  console.log(buffer.toString('utf8'));

  await server.close();
})();
```

  The managed TCP server does not need to be a Node application. In fact this module was originally developed to test
  [Mojolicious](https://mojolicious.org) web applications written in Perl with [Playwright](https://playwright.dev). For
  more details take a look at the [blog post](https://dev.to/kraih/playwright-and-mojolicious-21hn).

```js
const t = require('tap');
const starter = require('@mojolicious/server-starter');
const { chromium } = require('playwright');

t.test('Test the WebSocket chat', async t => {
  const server = await starter.newServer();
  await server.launch('perl', ['chat.pl', 'daemon', '-l', 'http://*?fd=3']);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = server.url();

  await page.goto(url);
  await page.click('text=Chat');
  t.equal(page.url(), url + '/chat');
  await page.click('input[type="text"]');
  await page.fill('input[type="text"]', 'test');
  await page.click('text=Send');
  await page.click('input[type="text"]');
  await page.fill('input[type="text"]', '123');
  await page.press('input[type="text"]', 'Enter');
  const firstMessage = await page.innerText('#messages p:nth-of-type(1)');
  t.equal(firstMessage, 'test');
  const secondMessage = await page.innerText('#messages p:nth-of-type(2)');
  t.equal(secondMessage, '123');

  await context.close();
  await browser.close();
  await server.close();
});
```
## Launching servers / platforms without file descriptor pass support.

  This module can be used with standard listening address, for platforms not supporting
  file description passing (like windows), or servers that can't reuse sockets passed
  as file descriptors.
  
- Portable listening address

  You can build a portable listening address using the ```listenAddress()``` function on ```server``` object. That function will return an absolute url that you can use to configure your server in a portable way.
  
  It will either be the string ```http://*?fd=3``` if file description pass is
  allowed, or have a format ```http://<address>:<port>``` that you can use as a listening address or parse it to get the parameters needed by your server (address and port).

  - on your test script:
```js
...
  const server = await starter.newServer();
  await server.launch('node', ['your/path/server.js', server.listenAdress]);
...
```

  - then on your server (```your/path/server.js``` file) you will get the listenAdress as a command parameter:
```js
// called as node server.js <listening address>

const http = require('http');
let listen = {fd: 3};
let parts = process.argv[2].match(/http:\/\/([^\/]+):(\d+)/);
if (parts) listen = {port: parts[2], address: parts[1]};
// at this point variable listen will either be {fd: 3} or {port: <port>, address: <address>},
// dependint on the first command argument (process.argv[2])

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
server.listen(listen);
```
Note that depending on the server application required format, listenAddress() string could be exactly all you need, like in the case of a Mojolicious app, to load it in a portable way you just use the returned string as the '-l' command argument:

```js
...
  const server = await starter.newServer();
  await server.launch('perl', ['your/path/app.pl', '-l', server.listenAdress]);
...
```

- Avoid usage of file description passing of listening socket

You can use the ENV variable ```MOJO_SERVER_STARTER_AVOID_FDPASS```:

```shell
export MOJO_SERVER_STARTER_AVOID_FDPASS=1
```

Default value is 0, and will use fd passing whenever is possible (i.e. except for windows platforms)

- Configurable timeout

When not using fd passing, there is a timeout to wait for the server to start listening. You configure it as option ```connectTimeout```, in mS, when calling the launch() function:

```js
  const server = await starter.newServer();
  await server.launch(<cmd>, <args>, {connectTimeout: 3000});
```

Default value is 30000 (30 secs).
This parameter has no effect when socket is passed through file descriptor (in that case waiting for the server is not necessary)

- Configurable retry time

When not using fd passing, the launch() function will check if the server is listening every ```retryTime``` mS. You can configure it as an option:

```js
  const server = await starter.newServer();
  await server.launch(<cmd>, <args>, {retryTime: 250});
```
Default value is 60 (60 mS).
This parameter has no effect when socket is passed through file descriptor (in that case waiting for the server is not necessary)

## Install

    $ npm i @mojolicious/server-starter
