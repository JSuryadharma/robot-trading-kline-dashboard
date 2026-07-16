import crypto from 'node:crypto';
import { URL } from 'node:url';

export class WebSocketHub {
  constructor(server, { authenticate, onMessage } = {}) {
    this.clients = new Set();
    this.authenticate = authenticate;
    this.onMessage = onMessage;

    server.on('upgrade', async (req, socket) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/ws') return;

      const user = await this.authenticate?.(req);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.accept(req, socket, user);
    });
  }

  accept(req, socket, user) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n'));

    const client = { socket, user };
    this.clients.add(client);
    socket.on('data', (buffer) => this.handleData(client, buffer));
    socket.on('close', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
  }

  handleData(client, buffer) {
    for (const frame of decodeFrames(buffer)) {
      if (frame.opcode === 0x8) {
        client.socket.end();
      } else if (frame.opcode === 0x9) {
        client.socket.write(encodeFrame(frame.payload, 0xA));
      } else if (frame.opcode === 0x1 && this.onMessage) {
        try {
          this.onMessage(client, JSON.parse(frame.payload.toString('utf8')));
        } catch {
          // Ignore malformed client messages.
        }
      }
    }
  }

  send(client, message) {
    if (client.socket.destroyed) {
      this.clients.delete(client);
      return;
    }
    client.socket.write(encodeFrame(Buffer.from(JSON.stringify(message), 'utf8')));
  }

  broadcast(message) {
    for (const client of this.clients) {
      this.send(client, message);
    }
  }
}

function encodeFrame(payload, opcode = 0x1) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65_536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    offset += 2;

    if (length === 126) {
      if (offset + 2 > buffer.length) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask;
    if (masked) {
      if (offset + 4 > buffer.length) break;
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (offset + length > buffer.length) break;
    const payload = Buffer.from(buffer.slice(offset, offset + length));
    offset += length;

    if (masked && mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }
    frames.push({ opcode, payload });
  }
  return frames;
}
