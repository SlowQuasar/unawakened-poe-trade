import { open } from 'node:fs/promises';

// Only positioned reads are exposed. Never open the installation for writing.
export class Ggpk {
  bytesRead = 0;
  records = new Map();
  static async open(path) {
    const self = new Ggpk();
    self.handle = await open(path, 'r');
    try {
      self.before = await self.handle.stat();
      const header = await self.read(0, 28);
      if (header.toString('ascii', 4, 8) !== 'GGPK' || header.readUInt32LE(0) !== 28)
        throw new Error('Unsupported GGPK header');
      self.version = header.readUInt32LE(8);
      if (![2, 3, 4].includes(self.version)) throw new Error('Unsupported GGPK version');
      self.root = Number(header.readBigUInt64LE(12));
      return self;
    } catch (error) { await self.handle.close(); throw error; }
  }
  async read(position, length) {
    if (!Number.isSafeInteger(position) || !Number.isSafeInteger(length) || position < 0 || length < 0 || position + length > this.before.size)
      throw new Error('GGPK read outside file');
    const data = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const { bytesRead } = await this.handle.read(data, done, length - done, position + done);
      if (!bytesRead) throw new Error('Unexpected EOF');
      done += bytesRead;
      this.bytesRead += bytesRead;
    }
    return data;
  }
  async record(offset) {
    if (this.records.has(offset)) return this.records.get(offset);
    const head = await this.read(offset, 16);
    const size = head.readUInt32LE(0), tag = head.toString('ascii', 4, 8);
    if (!['PDIR', 'FILE'].includes(tag)) throw new Error(`Unexpected record ${tag}`);
    if (size < 16 || offset + size > this.before.size) throw new Error('Record outside GGPK');
    const nameLength = head.readUInt32LE(8), width = this.version === 4 ? 4 : 2;
    const prefix = tag === 'PDIR' ? 48 : 44;
    const nameBytes = nameLength * width;
    if (!nameLength || nameLength > 4096 || prefix + nameBytes > size) throw new Error('Invalid record name');
    const rawName = await this.read(offset + prefix, nameBytes);
    const name = (width === 4
      ? Array.from({ length: nameLength }, (_, i) => String.fromCodePoint(rawName.readUInt32LE(i * 4))).join('')
      : rawName.toString('utf16le')).replace(/\0+$/, '');
    const dataOffset = offset + prefix + nameBytes;
    const result = { offset, size, tag, name, dataOffset, dataSize: size - prefix - nameBytes };
    if (tag === 'PDIR') {
      const count = head.readUInt32LE(12);
      if (count * 12 > result.dataSize) throw new Error('Invalid directory entries');
      const entries = await this.read(dataOffset, count * 12);
      result.children = Array.from({ length: count }, (_, i) => Number(entries.readBigUInt64LE(i * 12 + 4)));
    }
    this.records.set(offset, result);
    return result;
  }
  async find(path) {
    let current = await this.record(this.root);
    for (const part of path.split('/')) {
      let found;
      for (const offset of current.children ?? []) {
        const child = await this.record(offset);
        if (child.name.toLowerCase() === part.toLowerCase()) { found = child; break; }
      }
      if (!found) throw new Error(`GGPK file missing: ${path}`);
      current = found;
    }
    return current;
  }
  async fetchFile(path) {
    const record = await this.find(`Bundles2/${path}`);
    if (record.tag !== 'FILE') throw new Error('Not a FILE record');
    return this.read(record.dataOffset, record.dataSize);
  }
  async unchanged() {
    const after = await this.handle.stat();
    return after.size === this.before.size && after.mtimeMs === this.before.mtimeMs;
  }
  async close() { await this.handle.close(); }
}
