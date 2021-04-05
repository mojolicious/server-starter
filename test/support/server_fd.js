'use strict';

// Usage: node server-starter.js <listen address> <listen delay (mS)>
// <listen address> is mandatory

const http = require('http'); 
const delay = process.argv[3] ? process.argv[3] : 0;
let listen = {fd: 3};
let parts = process.argv[2].match(/http:\/\/([^\/]+):(\d+)/);
if (parts) listen = {port: parts[2], address: parts[1]};
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

// delayed start listening
(() => new Promise(resolve => {
  setTimeout(
    () => resolve(server.listen(listen)),
    delay)
}))();
