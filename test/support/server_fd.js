import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'X-Env': JSON.stringify(process.env)
  });
  res.end('Hello World!');
});
server.listen({fd: 3});
