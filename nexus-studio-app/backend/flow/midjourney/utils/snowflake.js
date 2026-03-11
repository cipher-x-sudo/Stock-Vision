/**
 * Snowflake ID generator for nonce/task id
 */

let sequence = 0;
const twepoch = 1355327999000;

export class SnowFlake {
  static INSTANCE = new SnowFlake();

  nextId() {
    const now = Date.now();
    const ts = (now - twepoch).toString(2).padStart(42, '0');
    sequence = (sequence + 1) & 0xfff;
    const seq = sequence.toString(2).padStart(12, '0');
    const worker = (1).toString(2).padStart(5, '0');
    const dc = (1).toString(2).padStart(5, '0');
    const bin = ts + dc + worker + seq;
    const id = BigInt('0b' + bin).toString();
    return id;
  }
}
