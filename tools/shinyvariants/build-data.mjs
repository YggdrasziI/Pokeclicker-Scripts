// Builds the shiny variant palettes embedded in custom/shinyvariants.user.js from
// PokéRogue's variant data and PokéClicker's sprites.
//
// PokéRogue does not ship a sprite per shiny variant: it recolours the base
// (non-shiny) sprite at run time with a colour -> colour table per species. The
// PokéClicker sprites are the same artwork with colours off by a unit or two, so
// the same tables apply, after matching colours with a small tolerance. Every
// PokéRogue key is mapped to a PokéClicker Pokémon by name, and a palette is kept
// only when enough of its colours exist in the PokéClicker sprite.
//
//   node tools/shinyvariants/build-data.mjs            # report only
//   node tools/shinyvariants/build-data.mjs --write    # also regenerate the data block
//
// Options: --pokeclicker <dir> --pokerogue <dir> --assets <dir> --script <file> --verbose
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, opaqueColors } from './png.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const options = {
    pokeclicker: 'E:/Projets/Dev/pokeclicker',
    pokerogue: 'E:/Projets/Dev/pokerogue',
    assets: 'E:/Projets/Dev/pokerogue-assets',
    script: path.join(REPO_ROOT, 'custom', 'shinyvariants.user.js'),
    write: false,
    verbose: false,
};
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--write' || arg === '--verbose') {
        options[arg.slice(2)] = true;
    } else if (arg.startsWith('--') && Object.hasOwn(options, arg.slice(2))) {
        options[arg.slice(2)] = process.argv[++i];
    } else {
        throw new Error(`Unknown option ${arg}`);
    }
}

// Same tolerance as the script: PokéClicker colours are within a unit or two of PokéRogue's
const TOLERANCE = 3;
// Palettes whose colours are found in the PokéClicker sprite below this fraction are dropped
const MIN_COVERAGE = 0.5;
const BORDERLINE_COVERAGE = 0.9;
const DATA_BEGIN = '// @@shiny-variants-data-begin';
const DATA_END = '// @@shiny-variants-data-end';

// Manual decisions, keyed by PokéClicker id (with -f for the female sprite):
// true keeps the palette whatever its coverage, false drops it
const OVERRIDES = {};

// PokéRogue species enum names (for the ids >= 2000) that are not "Title Case" of the words
const SPECIES_ALIASES = {
    MR_MIME: 'Mr. Mime',
    MR_RIME: 'Mr. Rime',
    FARFETCHD: 'Farfetch\'d',
    SIRFETCHD: 'Sirfetch\'d',
    NIDORAN_F: 'Nidoran(F)',
    NIDORAN_M: 'Nidoran(M)',
    HO_OH: 'Ho-Oh',
    PORYGON_Z: 'Porygon-Z',
    TYPE_NULL: 'Type: Null',
    JANGMO_O: 'Jangmo-o',
    HAKAMO_O: 'Hakamo-o',
    KOMMO_O: 'Kommo-o',
    FLABEBE: 'Flabébé',
    BATTLE_BOND_GRENINJA: 'Ash-Greninja',
    ETERNAL_FLOETTE: 'Floette (Eternal)',
};
const REGION_PREFIXES = {
    ALOLA_: 'Alolan ',
    GALAR_: 'Galarian ',
    HISUI_: 'Hisuian ',
    PALDEA_: 'Paldean ',
    BLOODMOON_: 'Bloodmoon ',
};

// PokéRogue form keys with a dedicated PokéClicker naming; B is the base Pokémon name
const FORM_CANDIDATES = {
    'mega': (B) => [`Mega ${B}`],
    'mega-x': (B) => [`Mega ${B} X`],
    'mega-y': (B) => [`Mega ${B} Y`],
    'primal': (B) => [`Primal ${B}`],
    'gigantamax': (B) => [`Gigantamax ${B}`],
    'eternamax': (B) => [`Eternamax ${B}`],
    'gigantamax-single': (B) => [`Gigantamax ${B} (Single Strike)`],
    'gigantamax-rapid': (B) => [`Gigantamax ${B} (Rapid Strike)`],
    'rapid-strike': (B) => [`${B} (Rapid Strike)`],
    'ash': () => ['Ash-Greninja'],
    'ice': (B) => [`Ice Rider ${B}`],
    'shadow': (B) => [`Shadow Rider ${B}`],
    'crowned': (B) => [`${B} (Crowned Sword)`, `${B} (Crowned Shield)`],
    'ultra': (B) => [`Ultra ${B}`],
    'sandy': (B) => [`${B} (Sand)`],
    'three': (B) => [`${B} (Family of Three)`],
    'exclamation': (B) => [`${B} (!)`],
    'question': (B) => [`${B} (?)`],
    'pau': (B) => [`${B} (Pa'u)`],
    'poke-ball': (B) => [`${B} (Poké Ball)`],
    'super': (B) => [`${B} (Super Size)`],
    'noice': (B) => [`${B} (Noice Face)`],
    'eternal': (B) => [`${B} (Eternal)`],
};
// Form keys that are the Pokémon's default appearance in PokéClicker
const BASE_FORM_KEYS = new Set([
    'incarnate', 'altered', 'land', 'ordinary', 'aria', 'shield', 'average', 'normal', 'midday',
    'solo', 'baile', 'overcast', 'west', 'plant', 'disguised', 'meteor', 'red-meteor', 'zero',
    'ice', 'red-striped', 'spring', 'standard', 'natural', 'neutral', 'full-belly', 'two-segment',
    'four', 'counterfeit', 'unremarkable', 'apex-build', 'ultimate-mode', 'curly', 'a', 'red',
    'green', 'meadow', 'single-strike', 'amped', 'ice-face', 'hero', 'phony', 'chest', 'roaming',
    'family-of-four', 'zero-form', 'droopy', 'stretchy',
]);
// Keys that have no PokéClicker counterpart at all
const SKIPPED_FORM_KEYS = /cosplay|^partner$|^back$|^mega-(z|original|curly|droopy|stretchy)$|^radiant-sun$|^full-moon$/;

function titleCase(text) {
    return text.replace(/(^|[\s-])([a-z])/g, (m, sep, letter) => sep + letter.toUpperCase());
}

function speciesName(enumName) {
    for (const [prefix, replacement] of Object.entries(REGION_PREFIXES)) {
        if (enumName.startsWith(prefix)) {
            return replacement + speciesName(enumName.slice(prefix.length));
        }
    }
    if (SPECIES_ALIASES[enumName]) {
        return SPECIES_ALIASES[enumName];
    }
    return enumName.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
}

// --- PokéClicker Pokémon names ------------------------------------------------------------

function loadPokeclickerPokemon() {
    const source = readFileSync(path.join(options.pokeclicker, 'src/modules/pokemons/PokemonList.ts'), 'utf8');
    const entryPattern = /'id':\s*(-?[\d.]+),\s*'name':\s*'((?:[^'\\]|\\.)*)'/g;
    const nameToId = new Map();
    const idToName = new Map();
    let match;
    while ((match = entryPattern.exec(source))) {
        const id = String(parseFloat(match[1]));
        const name = match[2].replace(/\\'/g, '\'');
        if (parseFloat(id) <= 0) {
            continue;
        }
        nameToId.set(name, id);
        idToName.set(id, name);
    }
    if (nameToId.size < 1000) {
        throw new Error(`Only ${nameToId.size} Pokémon found in PokemonList.ts, the file format probably changed`);
    }
    return { nameToId, idToName };
}

function loadPokerogueSpecies() {
    const source = readFileSync(path.join(options.pokerogue, 'src/enums/species-id.ts'), 'utf8');
    const enumPattern = /^\s+([A-Z_0-9]+)\s*=\s*(\d+),/gm;
    const idToEnum = new Map();
    let match;
    while ((match = enumPattern.exec(source))) {
        idToEnum.set(Number(match[2]), match[1]);
    }
    return idToEnum;
}

// --- Key resolution -----------------------------------------------------------------------

function resolveKey(key, pokeclicker, pokerogueSpecies) {
    const match = /^(\d+)(?:-(.+))?$/.exec(key);
    if (!match) {
        return { error: 'unexpected key format' };
    }
    const speciesId = Number(match[1]);
    const formKey = match[2];

    let baseName;
    if (speciesId >= 2000) {
        const enumName = pokerogueSpecies.get(speciesId);
        if (!enumName) {
            return { error: `species ${speciesId} not in species-id.ts` };
        }
        baseName = speciesName(enumName);
    } else {
        baseName = pokeclicker.idToName.get(String(speciesId));
    }
    if (!baseName || !pokeclicker.nameToId.has(baseName)) {
        return { error: `no PokéClicker Pokémon named '${baseName ?? speciesId}'` };
    }
    if (!formKey) {
        return { id: pokeclicker.nameToId.get(baseName), name: baseName };
    }
    if (SKIPPED_FORM_KEYS.test(formKey)) {
        return { skipped: true };
    }

    // PokéClicker names some default forms with a suffix ('Unown (A)', 'Vivillon (Meadow)'):
    // the other forms are named after the bare species
    const species = baseName.replace(/ \([^)]*\)$/, '');
    const candidates = FORM_CANDIDATES[formKey]?.(species) ?? [];
    const spaced = titleCase(formKey.replace(/-/g, ' '));
    const hyphenated = titleCase(formKey);
    candidates.push(`${species} (${spaced})`, `${species} (${hyphenated})`, `${species} (${spaced} Core)`, `${spaced} ${species}`);
    for (const candidate of candidates) {
        if (pokeclicker.nameToId.has(candidate)) {
            return { id: pokeclicker.nameToId.get(candidate), name: candidate };
        }
    }
    if (formKey === 'female') {
        // PokéClicker draws these as the female sprite of the base Pokémon
        return { id: `${pokeclicker.nameToId.get(baseName)}-f`, name: `${baseName} (female sprite)` };
    }
    if (BASE_FORM_KEYS.has(formKey)) {
        return { id: pokeclicker.nameToId.get(baseName), name: baseName };
    }
    return { error: `form '${formKey}' of ${baseName}: none of ${candidates.join(', ')}` };
}

// --- Palettes -----------------------------------------------------------------------------

function parseHex(text) {
    return /^[0-9a-f]{6}$/i.test(text) ? parseInt(text, 16) : null;
}

function loadPalette(file, slot) {
    if (!existsSync(file)) {
        return null;
    }
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const table = json[String(slot)];
    if (!table) {
        return null;
    }
    const pairs = [];
    for (const [from, to] of Object.entries(table)) {
        const source = parseHex(from);
        const target = parseHex(to);
        if (source !== null && target !== null) {
            pairs.push([source, target]);
        }
    }
    return pairs.length ? pairs : null;
}

function withinTolerance(a, b) {
    return Math.abs((a >> 16) - (b >> 16)) <= TOLERANCE
        && Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) <= TOLERANCE
        && Math.abs((a & 0xff) - (b & 0xff)) <= TOLERANCE;
}

function coverage(pairs, spriteColors) {
    const colors = [...spriteColors];
    const found = pairs.filter(([source]) => colors.some((color) => withinTolerance(color, source))).length;
    return found / pairs.length;
}

function encodePalette(pairs) {
    return pairs.map(([source, target]) => source.toString(16).padStart(6, '0') + target.toString(16).padStart(6, '0')).join('');
}

const spriteCache = new Map();
function spriteColors(spriteId) {
    if (!spriteCache.has(spriteId)) {
        const file = path.join(options.pokeclicker, 'src/assets/images/pokemon', `${spriteId}.png`);
        spriteCache.set(spriteId, existsSync(file) ? opaqueColors(decodePng(readFileSync(file))) : null);
    }
    return spriteCache.get(spriteId);
}

// --- Star icons ---------------------------------------------------------------------------

// PokéRogue's star icons are white pixels with alpha shading, tinted at run time.
// They become SVG paths filled with currentColor: one path per alpha level, one
// horizontal run of pixels per subpath, so the script tints them with CSS.
function iconPaths(image, frame) {
    const runs = new Map();
    for (let y = 0; y < frame.h; y++) {
        let x = 0;
        while (x < frame.w) {
            const alpha = image.data[((frame.y + y) * image.width + frame.x + x) * 4 + 3];
            if (alpha === 0) {
                x++;
                continue;
            }
            let length = 1;
            while (x + length < frame.w && image.data[((frame.y + y) * image.width + frame.x + x + length) * 4 + 3] === alpha) {
                length++;
            }
            if (!runs.has(alpha)) {
                runs.set(alpha, []);
            }
            runs.get(alpha).push(`M${x} ${y}h${length}v1h-${length}z`);
            x += length;
        }
    }
    return {
        w: frame.w,
        h: frame.h,
        paths: [...runs.entries()].map(([alpha, subpaths]) => [Number((alpha / 255).toFixed(2)), subpaths.join('')]),
    };
}

function loadIcons() {
    const uiDir = path.join(options.assets, 'images/ui');
    const atlas = JSON.parse(readFileSync(path.join(uiDir, 'shiny_icons.json'), 'utf8'));
    const sheet = decodePng(readFileSync(path.join(uiDir, 'shiny_icons.png')));
    const frames = atlas.textures[0].frames;
    const page = ['0', '1', '2'].map((name) => iconPaths(sheet, frames.find((f) => f.filename === name).frame));
    const small = decodePng(readFileSync(path.join(uiDir, 'shiny_small.png')));
    return { page, small: iconPaths(small, { x: 0, y: 0, w: small.width, h: small.height }) };
}

// --- Main ---------------------------------------------------------------------------------

function generation(id) {
    const dex = Math.floor(parseFloat(id));
    const limits = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
    return limits.findIndex((limit) => dex <= limit) + 1 || limits.length + 1;
}

function main() {
    const pokeclicker = loadPokeclickerPokemon();
    const pokerogueSpecies = loadPokerogueSpecies();
    const variantDir = path.join(options.assets, 'images/pokemon/variant');
    const masterlist = JSON.parse(readFileSync(path.join(variantDir, '_masterlist.json'), 'utf8'));
    const expFile = path.join(variantDir, '_exp_masterlist.json');
    const expMasterlist = existsSync(expFile) ? JSON.parse(readFileSync(expFile, 'utf8')) : {};

    const palettes = {};
    const unmapped = [];
    const rejected = [];
    const borderline = [];
    const stats = {};
    let dedicatedSprites = 0;
    let accepted = 0;
    let skipped = 0;

    const consider = (spriteId, slot, sources, label) => {
        const colors = spriteColors(spriteId);
        if (!colors) {
            return null;
        }
        let best = null;
        for (const [origin, pairs] of sources) {
            if (!pairs) {
                continue;
            }
            const score = coverage(pairs, colors);
            if (!best || score > best.score) {
                best = { origin, pairs, score };
            }
        }
        if (!best) {
            return null;
        }
        const override = OVERRIDES[spriteId];
        const keep = override ?? best.score >= MIN_COVERAGE;
        const entry = `${label} v${slot} (${spriteId}) ${best.origin} ${(best.score * 100).toFixed(0)}%`;
        if (!keep) {
            rejected.push(entry);
            return null;
        }
        if (best.score < BORDERLINE_COVERAGE) {
            borderline.push(entry);
        }
        return best.pairs;
    };

    // The masterlist nests the female and back sprite tables under their own keys
    const femaleMasterlist = masterlist.female ?? {};
    const expFemaleMasterlist = expMasterlist.female ?? {};

    for (const [key, codes] of Object.entries(masterlist)) {
        if (!Array.isArray(codes)) {
            continue;
        }
        const resolved = resolveKey(key, pokeclicker, pokerogueSpecies);
        if (resolved.skipped) {
            skipped++;
            continue;
        }
        if (resolved.error) {
            unmapped.push(`${key}: ${resolved.error}`);
            continue;
        }
        const expCodes = expMasterlist[key] ?? [];
        const gen = generation(resolved.id);
        stats[gen] = stats[gen] ?? { keys: 0, slots: 0, kept: 0 };
        stats[gen].keys++;

        for (const slot of [1, 2]) {
            if (codes[slot] === 2 && expCodes[slot] !== 1) {
                dedicatedSprites++;
                continue;
            }
            if (codes[slot] !== 1 && expCodes[slot] !== 1) {
                continue;
            }
            stats[gen].slots++;
            const female = resolved.id.endsWith('-f');
            const baseId = female ? resolved.id.slice(0, -2) : resolved.id;
            const sources = [];
            if (codes[slot] === 1) {
                sources.push(['main', loadPalette(path.join(variantDir, `${key}.json`), slot)]);
            }
            if (expCodes[slot] === 1) {
                sources.push(['exp', loadPalette(path.join(variantDir, 'exp', `${key}.json`), slot)]);
            }

            const pairs = consider(resolved.id, slot, sources, `${key} -> ${resolved.name}`);
            if (pairs) {
                palettes[resolved.id] = palettes[resolved.id] ?? [null, null];
                palettes[resolved.id][slot - 1] = encodePalette(pairs);
                stats[gen].kept++;
                accepted++;
            }

            // Female sprite: PokéRogue keeps a separate table when the female colours differ
            if (!female && spriteColors(`${baseId}-f`)) {
                const femaleSources = [];
                if (femaleMasterlist[key]?.[slot] === 1) {
                    femaleSources.push(['female', loadPalette(path.join(variantDir, 'female', `${key}.json`), slot)]);
                }
                if (expFemaleMasterlist[key]?.[slot] === 1) {
                    femaleSources.push(['exp/female', loadPalette(path.join(variantDir, 'exp/female', `${key}.json`), slot)]);
                }
                const hasFemaleTable = femaleSources.some(([, table]) => table);
                const femalePairs = consider(`${baseId}-f`, slot, hasFemaleTable ? femaleSources : sources, `${key} -> ${resolved.name} (female)`);
                const femaleId = `${baseId}-f`;
                if (hasFemaleTable && femalePairs) {
                    palettes[femaleId] = palettes[femaleId] ?? [null, null];
                    palettes[femaleId][slot - 1] = encodePalette(femalePairs);
                } else if (!femalePairs && pairs) {
                    // The male table does not fit the female sprite: no variant for it
                    palettes[femaleId] = palettes[femaleId] ?? [null, null];
                }
            }
        }
    }

    let source = 'pokerogue-assets';
    try {
        source += ` ${execSync('git rev-parse --short HEAD', { cwd: options.assets, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}`;
    } catch {
        source += ' (unknown revision)';
    }
    const data = { v: 1, src: source, tol: TOLERANCE, icons: loadIcons(), p: palettes };
    const serialized = JSON.stringify(data);

    console.log(`Masterlist keys: ${Object.keys(masterlist).length}, skipped on purpose: ${skipped}, unmapped: ${unmapped.length}`);
    console.log(`Palette slots kept: ${accepted}, rejected: ${rejected.length}, dedicated-sprite slots (no palette): ${dedicatedSprites}`);
    console.log('Per generation (keys / palette slots / kept):');
    for (const gen of Object.keys(stats).sort((a, b) => a - b)) {
        console.log(`  gen ${gen}: ${stats[gen].keys} / ${stats[gen].slots} / ${stats[gen].kept}`);
    }
    console.log(`Female sprite tables: ${Object.keys(palettes).filter((id) => id.endsWith('-f')).length}`);
    console.log(`Data size: ${(serialized.length / 1024).toFixed(0)} KB`);
    if (options.verbose) {
        console.log(`\nBorderline (${(MIN_COVERAGE * 100).toFixed(0)}-${(BORDERLINE_COVERAGE * 100).toFixed(0)}% of colours found):\n  ${borderline.join('\n  ')}`);
        console.log(`\nRejected:\n  ${rejected.join('\n  ')}`);
        console.log(`\nUnmapped:\n  ${unmapped.join('\n  ')}`);
    } else {
        console.log(`Borderline: ${borderline.length}, run with --verbose for the lists`);
    }

    if (options.write) {
        const script = readFileSync(options.script, 'utf8');
        const begin = script.indexOf(DATA_BEGIN);
        const end = script.indexOf(DATA_END);
        if (begin < 0 || end < 0 || end < begin) {
            throw new Error(`Data markers not found in ${options.script}`);
        }
        const beginLineEnd = script.indexOf('\n', begin);
        const updated = `${script.slice(0, beginLineEnd + 1)}const SHINY_VARIANT_DATA = ${serialized};\n${script.slice(end)}`;
        writeFileSync(options.script, updated);
        console.log(`Written to ${path.relative(REPO_ROOT, options.script)}`);
    }
}

main();
