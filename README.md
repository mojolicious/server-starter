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

  This module can be used with other ways to pass the listening address, for platforms not supporting
  file description passing (like windows), or servers that can't reuse sockets passed
  as file descriptors.

  Just as an example, suppose you have a simple js server that will listen in a port passed as a parameter:

```js
// called as node server.js <port>
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
// take the port value from the first command line argument (process.argv[2])
server.listen({ port: process.argv[2] });
```
To avoid passing the listen socket with a file descriptor, you have to define option ```avoidFdPassing``` to true:

```js
const starter = require('@mojolicious/server-starter');
const fetch = require('node-fetch');

(async () => {
  const server = await starter.newServer();
  await server.launch('node', ['server.js', server.port], { avoidFdPassing: true });
  const url = server.url();

  const res = await fetch(url);
  const buffer = await res.buffer();
  console.log(buffer.toString('utf8'));

  await server.close();
```

Note that depending on the acttual command line your server application needs to be started, either ```server.url()``` returned string or ```server.port``` could be exactly all you need to configure as a parameter when calling the ```launch``` function.
## Configurable timers

```launch()``` promise will not resolve until it can be verified that the launched server is actually listening. This behavior is controlled by two timers:

- ```connectTimeout```, in mS, allows to configure maximum time to wait for the launched server to start listening. Default is 30000 (30 secs).

```js
  const server = await starter.newServer();
  await server.launch(<cmd>, <args>, { connectTimeout: 3000 });
```

- ```retryTime```, in mS, allows to configure the time to retry a connection with the launched server. Default is 60 (60 mS).

```js
  const server = await starter.newServer();
  await server.launch(<cmd>, <args>, { retryTime: 250 });
```
## Caveats

- When ```avoidFdPassing``` mode is used with random port assignement (the default when you create your server with the createServer() function), a race condition is generated between the launched server and other potential processes asking for new random ports, because nothing prevents the operating system to reasign an already closed port to them.
## Install

    $ npm i @mojolicious/server-starter
