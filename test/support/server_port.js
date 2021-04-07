'use strict';

// Usage: node server_port.js <port number> <listen delay (mS)>
// <port number> is mandatory

const http = require('http');
const delay = process.argv[3] ? process.argv[3] : 0;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

// delayed start listening
(() => new Promise(resolve => {
  setTimeout(
    () => resolve(server.listen({ port: process.argv[2] })),
    delay)
}))();
