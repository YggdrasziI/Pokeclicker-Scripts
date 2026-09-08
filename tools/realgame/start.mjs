// Starts the real PokéClicker build under jsdom with the given userscripts, the way
// the desktop client does: the game's own bundles, the scripts injected before the
// game starts, then the game's start sequence. Fails when the game cannot start.
//
//   node tools/realgame/start.mjs                              # the game alone
//   node tools/realgame/start.mjs shinyvariants customachievements
//   node tools/realgame/start.mjs shinyvariants --scenario=path/to/scenario.js
//   node tools/realgame/start.mjs pokeclickerautomation --save=path/to/backup.txt
//
// Scripts are named by their file without .user.js, looked up in custom/ then at
// the root. A scenario is a plain script run in the page once the game started; it
// must set window.__scenario to true or false (see the README of this folder).
//
// The game build is the one the desktop client downloaded, under its data folder
// (%APPDATA%/pokeclicker-desktop/pokeclicker-master/docs); --docs=<dir> points at
// another build. --save=<file> starts from a save file instead of a fresh game: a
// game export or an Automation backup, the base64 the game's own "load from file"
// reads. jsdom comes from automation/test (run npm install there first).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'automation', 'test', 'package.json'));
const { JSDOM, VirtualConsole } = require('jsdom');

const options = {
    docs: path.join(process.env.APPDATA ?? '', 'pokeclicker-desktop', 'pokeclicker-master', 'docs'),
    scenario: null,
    save: null,
};
const scripts = [];
for (const arg of process.argv.slice(2)) {
    const match = /^--(docs|scenario|save)=(.+)$/.exec(arg);
    if (match) {
        options[match[1]] = match[2];
    } else if (arg.startsWith('--')) {
        throw new Error(`Unknown option ${arg}`);
    } else {
        scripts.push(arg);
    }
}
if (!existsSync(path.join(options.docs, 'index.html'))) {
    throw new Error(`No game build at ${options.docs}: run the desktop client once, or pass --docs=<dir>`);
}

// The page's own script tags, in order (index.html loads them with a version query)
const PAGE_SCRIPTS = [
    'libs/jquery.min.js', 'libs/knockout-latest.js', 'libs/Sortable.min.js',
    'scripts/modules.min.js', 'scripts/script.min.js',
    'libs/popper.min.js', 'libs/bootstrap.min.js', 'libs/bootstrap-notify.min.js', 'libs/intro.min.js',
];

function scriptFile(name) {
    for (const candidate of [path.join(REPO_ROOT, 'custom', `${name}.user.js`), path.join(REPO_ROOT, `${name}.user.js`)]) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error(`No script named ${name} in custom/ or at the root`);
}

// --- Page ---------------------------------------------------------------------------------

const pageErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => pageErrors.push(error));
virtualConsole.on('log', (...args) => {
    const text = args.map(String).join(' ');
    // The game's own timestamped, styled progress lines are noise here
    if (!/^\[\d|%c/.test(text)) {
        console.log(`[page] ${text.slice(0, 2000)}`);
    }
});
virtualConsole.on('error', (...args) => console.log('[page error]', ...args.map((a) => String(a).slice(0, 500))));
virtualConsole.on('warn', (...args) => {
    const text = args.map(String).join(' ');
    if (!/is not a valid value for setting|could not build|DEPRECATED|Bootstrap/.test(text)) {
        console.log(`[page warn] ${text.slice(0, 300)}`);
    }
});

const dom = await JSDOM.fromFile(path.join(options.docs, 'index.html'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    // A real origin: file:// is opaque and has no localStorage
    url: 'https://www.pokeclicker.com/',
    virtualConsole,
});
const { window } = dom;

// What the userscripts and the game expect from a browser and jsdom lacks
window.unsafeWindow = window;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.Notification = class { static permission = 'denied'; static requestPermission() { return Promise.resolve('denied'); } };
window.scrollTo = () => {};
window.CSS = window.CSS ?? { escape: (s) => String(s).replace(/([^\w-])/g, '\\$1'), supports: () => false };
window.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext ?? (() => null);

function run(code, name) {
    const script = window.document.createElement('script');
    script.textContent = code;
    window.document.head.appendChild(script);
    if (pageErrors.length) {
        console.log(`errors while running ${name}:\n${pageErrors.map((e) => String(e.detail?.stack ?? e.message ?? e).slice(0, 800)).join('\n')}`);
        pageErrors.length = 0;
        return false;
    }
    return true;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Sequence -----------------------------------------------------------------------------

let ok = true;
for (const src of PAGE_SCRIPTS) {
    ok = run(readFileSync(path.join(options.docs, src), 'utf8'), src) && ok;
}
run('window.__probe = { client: App.isUsingClient, version: document.querySelector(\'script[src*="modules.min.js"]\')?.src.split("v=")[1] };', 'probe');
console.log(`game bundles loaded (${options.docs})`);

for (const name of scripts) {
    // The desktop client enables a downloaded script through this flag
    window.localStorage.setItem(name, 'true');
    ok = run(readFileSync(scriptFile(name), 'utf8'), name) && ok;
}
// The priority functions run on $(document).ready
await wait(300);
if (pageErrors.length) {
    console.log(`errors in the priority functions:\n${pageErrors.map((e) => String(e.detail?.stack ?? e.message ?? e).slice(0, 800)).join('\n')}`);
    pageErrors.length = 0;
    ok = false;
}

// A save file is what the game's Save.loadFromFile stores before reloading the page:
// the three localStorage entries the Game constructor and initialize() read
if (options.save) {
    const contents = readFileSync(options.save, 'utf8').trim();
    ok = run(`
try {
    let decoded;
    try { decoded = SaveSelector.atob(${JSON.stringify(contents)}); } catch (e) { decoded = null; }
    const json = JSON.parse(decoded || ${JSON.stringify(contents)});
    if (!json.player || !json.save) {
        throw new Error('not a save file: no player or save entry');
    }
    localStorage.setItem('player', JSON.stringify(json.player));
    localStorage.setItem('save', JSON.stringify(json.save));
    if (json.settings) {
        localStorage.setItem('settings', JSON.stringify(json.settings));
    }
    console.log('save loaded: ' + (json.save.profile?.name ?? 'unnamed') + ', region ' + json.player.highestRegion);
} catch (error) {
    console.log('SAVE LOAD FAILED: ' + (error.stack || error));
    throw error;
}
`, 'save') && ok;
}

// App.start once the assets are loaded, without Preload
run(`
try {
    ko.options.deferUpdates = true;
    Save.key = '';
    App.game = new Game();
    App.game.initialize();
    // Preload.hideSplashScreen is where loadEpheniaScript runs the scripts' initializers
    Preload.hideSplashScreen();
    console.log('game started: ' + AchievementHandler.achievementList.length + ' achievements, ' + App.game.party.caughtPokemon.length + ' party Pokémon');
    window.__started = true;
} catch (error) {
    console.log('START FAILED: ' + (error.stack || error));
    window.__started = false;
}
`, 'start');
await wait(500);
if (pageErrors.length) {
    console.log(`errors during the start:\n${pageErrors.map((e) => String(e.detail?.stack ?? e.message ?? e).slice(0, 800)).join('\n')}`);
    pageErrors.length = 0;
}
ok = ok && window.__started === true;

if (ok && options.scenario) {
    run(readFileSync(options.scenario, 'utf8'), 'scenario');
    await wait(500);
    if (pageErrors.length) {
        console.log(`errors during the scenario:\n${pageErrors.map((e) => String(e.detail?.stack ?? e.message ?? e).slice(0, 800)).join('\n')}`);
    }
    console.log(`scenario: ${window.__scenario === true ? 'ok' : 'FAILED'}`);
    ok = window.__scenario === true;
}

console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
