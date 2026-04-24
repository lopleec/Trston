import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sizes = [16, 32, 48, 128];
const outputDir = new URL("../icons/", import.meta.url);
const outputDirPath = fileURLToPath(outputDir);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

mkdirSync(outputDirPath, { recursive: true });

for (const size of sizes) {
  const png = createIconPng(size);
  writeFileSync(join(outputDirPath, `icon-${size}.png`), png);
}

console.log(`Generated ${sizes.length} Trston icons.`);

function createIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const alpha = roundedRectAlpha(x, y, size, radius);
      const shade = 10 + Math.round(((x + y) / (size * 2)) * 22);
      const onLetter = isLetterPixel(x, y, size, center);

      pixels[index] = onLetter ? 255 : shade;
      pixels[index + 1] = onLetter ? 255 : shade;
      pixels[index + 2] = onLetter ? 255 : shade;
      pixels[index + 3] = alpha;
    }
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", createIhdr(size, size)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function createIhdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function roundedRectAlpha(x, y, size, radius) {
  const inset = 0.5;
  const max = size - 1 - inset;
  const px = Math.min(Math.max(x, inset), max);
  const py = Math.min(Math.max(y, inset), max);
  const cx = px < radius ? radius : px > size - radius ? size - radius : px;
  const cy = py < radius ? radius : py > size - radius ? size - radius : py;
  const distance = Math.hypot(px - cx, py - cy);
  const edge = radius - distance;
  return Math.max(0, Math.min(255, Math.round(edge * 255)));
}

function isLetterPixel(x, y, size, center) {
  const topY = size * 0.28;
  const barHeight = Math.max(2, size * 0.12);
  const barWidth = size * 0.58;
  const stemWidth = Math.max(2, size * 0.16);
  const stemBottom = size * 0.72;
  const inTop = y >= topY && y <= topY + barHeight && Math.abs(x - center) <= barWidth / 2;
  const inStem = y >= topY && y <= stemBottom && Math.abs(x - center) <= stemWidth / 2;
  return inTop || inStem;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
