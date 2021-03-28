'use strict';

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});
server.listen(process.env.TEST_SERVER_STARTER_PORT ? process.env.TEST_SERVER_STARTER_PORT : { fd: 3 });
