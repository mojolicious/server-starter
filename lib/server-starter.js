/*!
 * server-starter
 * Copyright(c) 2021 Sebastian Riedel
 * Artistic-2.0 Licensed
 */
'use strict';

const { EventEmitter } = require('events');
const net = require('net');
const { spawn } = require('child_process');

/**
 * Class representing a superdaemon that can manage one or more servers
 */
class ServerStarter {
  /**
   * Create a server
   * @param {number} [port=0] - Optional port to listen on
   * @param {string} [address] - Optional address to listen on
   * @returns {Server}
   */
  newServer (port, address) {
    const server = new Server(port, address);
    return server.listen().then(() => server);
  }
}

/**
 * Class representing a server to be managed
 */
class Server extends EventEmitter {
  /**
   * Create a server
   * @param {number} [port=0] - Optional port to listen on
   * @param {string} [address] - Optional address to listen on
   */
  constructor (port, address) {
    super();
    this._originalPort = port || 0;
    this._originalAddress = address;
    this.port = undefined;
    this._fd = undefined;
    this._srv = undefined;
    this._process = undefined;
    this._exitHandlers = [];
    this._exit = undefined;
    this.listenAddress = undefined;
  }

  /**
   * Stop managed server
   * @param {string|number} [signal=SIGINT] - Optional signal to use
   * @returns {Promise}
   */
  close (signal = 'SIGINT') {
    this._process.kill(signal);
    if (typeof this._exit !== 'undefined') return Promise.resolve;
    return new Promise(resolve => this._exitHandlers.push(resolve));
  }

  /**
   * Launch server
   * @param {string} cmd - Server command to run
   * @param {string[]} args - Arguments to use with server command
   * @param {object} [options] - Optional settings
   * @param {boolean} [options.stdout=false] - Forward server output from STDOUT to STDOUT
   * @param {boolean} [options.stderr=true] - Forward server output from STDERR to STDERR
   * @param {number} [options.connectTimeout=30000] - Max time to wait for server ready, in mS
   * @param {number} [options.retryTime=60] - Time to retry for server ready, in mS
   * @param {boolean} [options.fdPassingAllowed=true] - Allow File Descriptor 3 listening (when possible)
   * @returns {Promise}
   */
  launch (cmd, args, options = {}) {
    if (typeof this._process !== 'undefined') throw new Error('Server already launched');
    const stdout = typeof options.stdout !== 'undefined' ? options.stdout : false;
    const stderr = typeof options.stderr !== 'undefined' ? options.stderr : true;
    const connectTimeout = typeof options.connectTimeout !== 'undefined' ? options.connectTimeout : 30000;
    const retryTime = typeof options.retryTime !== 'undefined' ? options.retryTime : 60;
    const fdPassingAllowed = typeof options.fdPassingAllowed !== 'undefined' ? options.fdPassingAllowed : true;
    const useFileDescriptor = process.platform !== 'win32' && fdPassingAllowed;
    const spawnOptions = useFileDescriptor ? { stdio: ['pipe', 'pipe', 'pipe', this._fd] } : undefined;
    this.listenAddress = useFileDescriptor ? 'http://*?fd=3' : this.url();
    const proc = (this._process = spawn(cmd, args, spawnOptions));
    proc.on('error', e => this.emit('error', e));
    proc.stdout.on('data', data => {
      if (stdout) process.stdout.write(data.toString('utf8'));
      this.emit('stdout', data);
    });
    proc.stderr.on('data', data => {
      if (stderr) process.stderr.write(data.toString('utf8'));
      this.emit('stderr', data);
    });
    proc.on('exit', (code, signal) => {
      this._exit = true;
      this._process = undefined;
      this._exitHandlers.forEach(item => item());
      this.emit('exit', code, signal);
    });

    // Should be resolved by the "spawn" event, but that is only supported in Node 15+
    if (useFileDescriptor) return this._srv.close;
    return this._srv.close().then((resolve) => {
      const now = new Date();
      const timeToStop = new Date(now.getTime() + connectTimeout);
      const port = this.port;
      (function loop () {
        const connection = net.connect(port, resolve);
        connection.on('error', err => {
          if (err.code === 'ECONNREFUSED' && new Date() < timeToStop) setTimeout(loop, retryTime);
          else resolve(); // this is intented: don't reject, just stop delaying
        });
      })();
    });
  }

  /**
   * Start listen socket
   * @returns {Promise}
   */
  listen () {
    return new Promise(resolve => {
      const srv = net.createServer();
      srv.listen(this._originalPort, this._originalAddress, () => {
        this._srv = srv;
        this.port = srv.address().port;
        this._fd = srv._handle.fd;
        resolve();
      });
    });
  }

  /**
   * PID of the launched process
   * @returns {number|null}
   */
  pid () {
    return this._process ? this._process.pid : null;
  }

  /**
   * URL of the launched server
   * @returns {string}
   */
  url () {
    const address = this._originalAddress || '127.0.0.1';
    const port = this.port;
    return `http://${address}:${port}`;
  }
}

exports = module.exports = new ServerStarter();
exports.starter = exports;
