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
 * Class representing a superdaemon that handles socket activation and can manage one or more servers
 */
class ServerStarter {
  /**
   * Create a server
   * @param {number} [port=0] - Optional port to listen on
   * @param {string} [address] - Optional address to listen on
   * @returns {Promise<Server>}
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
    this._port = undefined;
    this._fd = undefined;
    this._srv = undefined;
    this._process = undefined;
    this._exitHandlers = [];
    this._exit = undefined;
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
   * @param {boolean} [options.avoidFdPassing=false] - Don't allow file description passing
   * @param {number} [options.connectTimeout=30000] - Max time to wait for server ready, in mS
   * @param {number} [options.retryTime=60] - Time to retry for server ready, in mS
   * @returns {Promise}
   */
  launch (cmd, args, options = {}) {
    if (typeof this._process !== 'undefined') throw new Error('Server already launched');
    const stdout = typeof options.stdout !== 'undefined' ? options.stdout : false;
    const stderr = typeof options.stderr !== 'undefined' ? options.stderr : true;
    const avoidFdPassing = typeof options.avoidFdPassing !== 'undefined' ? options.avoidFdPassing : false;
    const connectTimeout = typeof options.connectTimeout !== 'undefined' ? options.connectTimeout : 30000;
    const retryTime = typeof options.retryTime !== 'undefined' ? options.retryTime : 60;
    const spawnOptions = avoidFdPassing ? undefined : { stdio: ['pipe', 'pipe', 'pipe', this._fd] };
    const proc = (this._process = spawn(cmd, args, spawnOptions));
    proc.on('error', e => this.emit('error', e));
    if (stdout) proc.stdout.pipe(process.stdout);
    if (stderr) proc.stderr.pipe(process.stderr);
    proc.stdout.on('data', data => this.emit('stdout', data));
    proc.stderr.on('data', data => this.emit('stderr', data));

    proc.on('exit', (code, signal) => {
      this._exit = true;
      this._process = undefined;
      this._exitHandlers.forEach(item => item());
      this.emit('exit', code, signal);
    });

    return new Promise((resolve, reject) => this._srv.close(
      () => {
        if (this._useFdPass) resolve();
        else {
          const timeToStop = new Date(Date.now() + connectTimeout);
          const port = this.port;
          (function loop () {
            const connection = net.connect(port, resolve);
            connection.on('error', err => {
              if (err.code === 'ECONNREFUSED' && new Date() < timeToStop) setTimeout(loop, retryTime);
              else reject(err);
            });
          })();
        }
      }
    ));
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
        this._port = srv.address().port;
        this._fd = srv._handle.fd;
        resolve();
      });
    });
  }

  /**
   * PID of the launched process
   * @type {number|null}
   */
  get pid () {
    return this._process ? this._process.pid : null;
  }

  /**
   * Port of activated socket
   * @type {number}
   */
  get port () {
    return this._port;
  }

  /**
   * Full URL of the launched server with "http" scheme
   * @returns {string}
   */
  url () {
    const address = this._originalAddress || '127.0.0.1';
    const port = this.port;
    return `http://${address}:${port}`;
  }

  /**
   * Listen Address to configure service to be launched
   * @returns {string}
   */
  listenAddress () {
    if (this._useFdPass) return 'http://*?fd=3';
    return this.url();
  }
}

exports = module.exports = new ServerStarter();
exports.starter = exports;
