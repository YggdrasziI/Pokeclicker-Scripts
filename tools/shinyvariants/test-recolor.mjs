// Checks the recolouring shipped in custom/shinyvariants.user.js against PokéRogue:
// the PokéClicker sprite recoloured with the embedded palette must only produce
// colours that PokéRogue's own sprite produces with the same table, and most of
// the table must apply.
//
//   node tools/shinyvariants/test-recolor.mjs                 # default cases
//   node tools/shinyvariants/test-recolor.mjs 3:1 6.01=6-mega-x:2 3-f:1
//     <pokeclicker id>[-f][=<pokerogue key>]:<variant>, the key defaulting to the id
//
// Options: --pokeclicker <dir> --assets <dir>
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, opaqueColors } from './png.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const options = {
    pokeclicker: 'E:/Projets/Dev/pokeclicker',
    assets: 'E:/Projets/Dev/pokerogue-assets',
};
const cases = [];
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--') && Object.hasOwn(options, arg.slice(2))) {
        options[arg.slice(2)] = process.argv[++i];
    } else {
        cases.push(arg);
    }
}
if (!cases.length) {
    // Bulbasaur line, Mega Charizard X, regional forms, female Venusaur, a gen 5 and a gen 8 Pokémon
    cases.push('1:1', '3:2', '6.01=6-mega-x:1', '26.01=2026:2', '52.02=2052:1', '77.01=4077:2', '3-f:1', '497:1', '887:2');
}

// --- The shipped code -------------------------------------------------------------------

const script = readFileSync(path.join(REPO_ROOT, 'custom', 'shinyvariants.user.js'), 'utf8');
const dataMatch = /const SHINY_VARIANT_DATA = (.*);\n/.exec(script);
const codeMatch = /\/\/ @@recolor-begin\n([\s\S]*?)\/\/ @@recolor-end/.exec(script);
if (!dataMatch || !codeMatch) {
    throw new Error('Data block or recolour markers not found in the script');
}
const data = JSON.parse(dataMatch[1]);
const { recolorPixels } = new Function(`class Shipped { ${codeMatch[1]} } return Shipped;`)();

function decodePalette(encoded) {
    const table = new Map();
    for (let i = 0; i + 12 <= encoded.length; i += 12) {
        table.set(parseInt(encoded.slice(i, i + 6), 16), parseInt(encoded.slice(i + 6, i + 12), 16));
    }
    return table;
}

// --- PokéRogue reference -----------------------------------------------------------------

function pokerogueFrame(key, female) {
    const base = path.join(options.assets, 'images/pokemon', female ? 'female' : '', key);
    const atlas = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
    const image = decodePng(readFileSync(`${base}.png`));
    // Two atlas layouts exist: TexturePacker's "textures" and Aseprite's flat "frames"
    const frames = atlas.textures?.[0]?.frames ?? atlas.frames;
    const { frame } = Array.isArray(frames) ? frames[0] : Object.values(frames)[0];
    const data = new Uint8Array(frame.w * frame.h * 4);
    for (let y = 0; y < frame.h; y++) {
        const from = ((frame.y + y) * image.width + frame.x) * 4;
        data.set(image.data.subarray(from, from + frame.w * 4), y * frame.w * 4);
    }
    return { width: frame.w, height: frame.h, data };
}

function pokerogueTable(key, female, variant) {
    const file = path.join(options.assets, 'images/pokemon/variant', female ? 'female' : '', `${key}.json`);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const table = new Map();
    Object.entries(json[String(variant)]).forEach(([from, to]) => table.set(parseInt(from, 16), parseInt(to, 16)));
    return table;
}

// --- Cases --------------------------------------------------------------------------------

let failures = 0;
for (const testCase of cases) {
    const [spec, variantText] = testCase.split(':');
    const [pokeclickerId, explicitKey] = spec.split('=');
    const variant = Number(variantText);
    const female = pokeclickerId.endsWith('-f');
    const baseId = female ? pokeclickerId.slice(0, -2) : pokeclickerId;
    const key = explicitKey ?? baseId;
    const label = `${pokeclickerId} variant ${variant} (PokéRogue ${key})`;

    const encoded = data.p[pokeclickerId]?.[variant - 1] ?? (female ? data.p[baseId]?.[variant - 1] : undefined);
    if (!encoded) {
        console.log(`SKIP ${label}: no palette in the script`);
        continue;
    }
    const spriteFile = path.join(options.pokeclicker, 'src/assets/images/pokemon', `${baseId}${female ? '-f' : ''}.png`);
    if (!existsSync(spriteFile)) {
        console.log(`SKIP ${label}: no PokéClicker sprite`);
        continue;
    }

    const sprite = decodePng(readFileSync(spriteFile));
    const before = opaqueColors(sprite);
    recolorPixels(sprite.data, decodePalette(encoded), data.tol);
    const after = opaqueColors(sprite);

    const reference = pokerogueFrame(key, female && existsSync(path.join(options.assets, 'images/pokemon/female', `${key}.png`)));
    const table = pokerogueTable(key, female && existsSync(path.join(options.assets, 'images/pokemon/variant/female', `${key}.json`)), variant);
    recolorPixels(reference.data, table, 0);
    const expected = opaqueColors(reference);

    const produced = [...after].filter((color) => !before.has(color));
    const unexpected = produced.filter((color) => !expected.has(color));
    const applied = [...table.values()].filter((color) => after.has(color)).length;
    const ratio = applied / table.size;

    const problems = [];
    if (unexpected.length) {
        problems.push(`${unexpected.length} colour(s) PokéRogue never produces: ${unexpected.map((c) => c.toString(16).padStart(6, '0')).join(' ')}`);
    }
    if (ratio < 0.5) {
        problems.push(`only ${applied}/${table.size} table colours applied`);
    }
    if (!produced.length) {
        problems.push('nothing was recoloured');
    }
    if (problems.length) {
        failures++;
        console.log(`FAIL ${label}: ${problems.join('; ')}`);
    } else {
        console.log(`ok   ${label}: ${applied}/${table.size} table colours applied, ${produced.length} colours changed`);
    }
}

if (failures) {
    console.log(`${failures} case(s) failed`);
    process.exit(1);
}
