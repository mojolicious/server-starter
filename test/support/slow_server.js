'use strict';

const http = require('http');
const delay = process.argv[2] ? process.argv[2] : 1000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
(() => new Promise(resolve => {
  setTimeout(
    () => resolve(server.listen(process.env.TEST_SERVER_STARTER_PORT ? process.env.TEST_SERVER_STARTER_PORT : { fd: 3 })),
    delay)
}))();