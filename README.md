# server-starter [![](https://github.com/mojolicious/server-starter/workflows/test/badge.svg)](https://github.com/mojolicious/server-starter/actions)

  UNIX superdaemon with support for socket activation.

## Description

  This module exists to handle socket activation for TCP servers running in separate processes on UNIX. It is capable of
  assigning random ports to avoid race conditions when there are many services running in parallel on the same machine.
  As is common with large scale testing.
  
  The superdaemon will create the listen socket and pass it to the managed process as `fd3`, similar to how `systemd`
  handles socket activation. This also avoids any race conditions between spawning the managed process and sending the
  first request, since the listen socket is active the whole time.

```js
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
server.listen({ fd: 3 });
```

  All the web application has to do is use `fd3` as its listen socket to accept new connections from.

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
  [Mojolicious](https://mojolicious.org) web applications written in Perl with [Playwright](https://playwright.dev).

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

## Install

    $ npm i @mojolicious/server-starter
