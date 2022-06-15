/*!
 * server-starter
 * Copyright(c) 2021 Sebastian Riedel
 * Artistic-2.0 Licensed
 */
import {spawn} from 'child_process';
import {EventEmitter} from 'events';
import net from 'net';

export default class ServerStarter extends EventEmitter {
  /**
   * Create a server to handle socket activation.
   * @param {number} [port=0] - Optional port to listen on.
   * @param {string} [address] - Optional address to listen on.
   */
  constructor(port, address) {
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
   * Stop managed server.
   * @param {string|number} [signal=SIGINT] - Optional signal to use.
   */
  close(signal = 'SIGINT') {
    this._process.kill(signal);
    if (this._exit !== undefined) return Promise.resolve;
    return new Promise(resolve => this._exitHandlers.push(resolve));
  }

  /**
   * Launch server.
   * @param {string} cmd - Server command to run.
   * @param {string[]} args - Arguments to use with server command.
   * @param {object} [options] - Optional settings.
   * @param {object} [options.env=process.env] - Environment key-value pairs.
   * @param {boolean} [options.stdout=false] - Forward server output from STDOUT to STDOUT.
   * @param {boolean} [options.stderr=true] - Forward server output from STDERR to STDERR.
   */
  launch(cmd, args, options = {}) {
    if (this._process !== undefined) throw new Error('Server already launched');
    const stdout = options.stdout ?? false;
    const stderr = options.stderr ?? true;

    const spawnOptions = {stdio: ['pipe', 'pipe', 'pipe', this._fd]};
    if (options.env !== undefined) spawnOptions.env = options.env;

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

    return new Promise(resolve => this._srv.close(resolve));
  }

  /**
   * Start listen socket.
   */
  listen() {
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
   * Create a superdaemon to handle socket activation.
   * @param {number} [port=0] - Optional port to listen on.
   * @param {string} [address] - Optional address to listen on.
   */
  static newServer(port, address) {
    const server = new ServerStarter(port, address);
    return server.listen().then(() => server);
  }

  /**
   * PID of the launched process.
   */
  get pid() {
    return this._process ? this._process.pid : null;
  }

  /**
   * Port of activated socket.
   */
  get port() {
    return this._port;
  }

  /**
   * Full URL of the launched server with "http" scheme.
   */
  url() {
    const address = this._originalAddress || '127.0.0.1';
    const port = this.port;
    return `http://${address}:${port}`;
  }
}
