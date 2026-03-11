const MAX = 500;
const lines = [];

export function append(message) {
  const ts = new Date().toISOString().slice(11, 19);
  lines.push({ ts, message: String(message) });
  while (lines.length > MAX) lines.shift();
}

export function getLines() {
  return [...lines];
}
