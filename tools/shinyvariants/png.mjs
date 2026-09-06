// Minimal PNG decoder for the sprite tooling: no dependency, non-interlaced
// images only, every colour type and bit depth the game sprites use.
// Returns { width, height, data } with data an RGBA Uint8Array.
import { inflateSync } from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodePng(buffer) {
    for (let i = 0; i < SIGNATURE.length; i++) {
        if (buffer[i] !== SIGNATURE[i]) {
            throw new Error('Not a PNG file');
        }
    }

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    let palette = null;
    let transparency = null;
    const idat = [];

    let offset = 8;
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('latin1', offset + 4, offset + 8);
        const chunk = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = chunk.readUInt32BE(0);
            height = chunk.readUInt32BE(4);
            bitDepth = chunk[8];
            colorType = chunk[9];
            interlace = chunk[12];
        } else if (type === 'PLTE') {
            palette = chunk;
        } else if (type === 'tRNS') {
            transparency = chunk;
        } else if (type === 'IDAT') {
            idat.push(chunk);
        } else if (type === 'IEND') {
            break;
        }
        offset += 12 + length;
    }

    if (interlace !== 0) {
        throw new Error('Interlaced PNG files are not supported');
    }

    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (channels === undefined) {
        throw new Error(`Unsupported colour type ${colorType}`);
    }

    const bitsPerPixel = channels * bitDepth;
    const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
    const stride = Math.ceil((width * bitsPerPixel) / 8);
    const raw = inflateSync(Buffer.concat(idat));
    const unfiltered = Buffer.alloc(stride * height);

    let previous = Buffer.alloc(stride);
    let position = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[position++];
        const line = unfiltered.subarray(y * stride, (y + 1) * stride);
        raw.copy(line, 0, position, position + stride);
        position += stride;
        for (let x = 0; x < stride; x++) {
            const left = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0;
            const up = previous[x];
            const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
            switch (filter) {
                case 0: break;
                case 1: line[x] = (line[x] + left) & 0xff; break;
                case 2: line[x] = (line[x] + up) & 0xff; break;
                case 3: line[x] = (line[x] + ((left + up) >> 1)) & 0xff; break;
                case 4: {
                    const p = left + up - upLeft;
                    const pa = Math.abs(p - left);
                    const pb = Math.abs(p - up);
                    const pc = Math.abs(p - upLeft);
                    const predictor = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
                    line[x] = (line[x] + predictor) & 0xff;
                    break;
                }
                default: throw new Error(`Unknown filter type ${filter}`);
            }
        }
        previous = line;
    }

    const data = new Uint8Array(width * height * 4);
    const maxValue = (1 << bitDepth) - 1;

    const readSample = (line, index) => {
        if (bitDepth === 8) {
            return line[index];
        }
        if (bitDepth === 16) {
            return line[index * 2];
        }
        const bitOffset = index * bitDepth;
        const byte = line[bitOffset >> 3];
        const shift = 8 - bitDepth - (bitOffset & 7);
        return (byte >> shift) & maxValue;
    };
    const scale = (value) => (bitDepth === 16 ? value : Math.round((value * 255) / maxValue));

    for (let y = 0; y < height; y++) {
        const line = unfiltered.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < width; x++) {
            const out = (y * width + x) * 4;
            switch (colorType) {
                case 0: {
                    const grey = readSample(line, x);
                    const value = scale(grey);
                    data[out] = value; data[out + 1] = value; data[out + 2] = value;
                    data[out + 3] = (transparency && transparency.readUInt16BE(0) === grey) ? 0 : 255;
                    break;
                }
                case 2: {
                    const r = readSample(line, x * 3);
                    const g = readSample(line, x * 3 + 1);
                    const b = readSample(line, x * 3 + 2);
                    data[out] = scale(r); data[out + 1] = scale(g); data[out + 2] = scale(b);
                    data[out + 3] = (transparency && transparency.readUInt16BE(0) === r
                        && transparency.readUInt16BE(2) === g && transparency.readUInt16BE(4) === b) ? 0 : 255;
                    break;
                }
                case 3: {
                    const index = readSample(line, x);
                    data[out] = palette[index * 3];
                    data[out + 1] = palette[index * 3 + 1];
                    data[out + 2] = palette[index * 3 + 2];
                    data[out + 3] = (transparency && index < transparency.length) ? transparency[index] : 255;
                    break;
                }
                case 4: {
                    const value = scale(readSample(line, x * 2));
                    data[out] = value; data[out + 1] = value; data[out + 2] = value;
                    data[out + 3] = scale(readSample(line, x * 2 + 1));
                    break;
                }
                case 6: {
                    data[out] = scale(readSample(line, x * 4));
                    data[out + 1] = scale(readSample(line, x * 4 + 1));
                    data[out + 2] = scale(readSample(line, x * 4 + 2));
                    data[out + 3] = scale(readSample(line, x * 4 + 3));
                    break;
                }
                default: break;
            }
        }
    }

    return { width, height, data };
}

// Distinct opaque colours of an RGBA buffer, as packed 0xRRGGBB integers
export function opaqueColors(image) {
    const colors = new Set();
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
    }
    return colors;
}
