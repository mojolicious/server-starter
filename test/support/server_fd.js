import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'X-Env': JSON.stringify(process.env)
  });
  res.end('Hello World!');
});
server.listen({fd: 3});

if (process.argv.length > 2 && process.argv[2] === '-additional-fd') {
  const server2 = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'X-Env': JSON.stringify(process.env)
    });
    res.end('Hello again World!');
  });
  server2.listen({fd: 4});
}
