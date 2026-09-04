// Drives the full BuildMenu init for every module Automation.js enables, against a
// stubbed game. It catches modules that crash while building their menu, and reports
// which tabs and features they registered.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { makeGameStub } from './gamestub.mjs';

const BUNDLE = new URL('../../pokeclickerautomation.user.js', import.meta.url);

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="game" class=""></div>
  <div id="right-column" class="col-12"></div>
  <div id="battleCafeModal"></div>
  <div id="farmModal"></div>
</body></html>`);

const ctx = makeGameStub(dom.window);
vm.createContext(ctx);

const code = await readFile(BUNDLE, 'utf8');

// Mirror the module list Automation.js initializes, so a module added there without
// being wired here shows up as a gap.
const MODULES = ['Click', 'ClickStats', 'Focus', 'Hatchery', 'Underground', 'Farm', 'Shop', 'Items',
                 'Vitamins', 'Notifications', 'SaveBackup', 'Trivia', 'Gym', 'Dungeon',
                 'BattleFrontier', 'BattleCafe'];

const driver = `
;(() => {
    globalThis.__results = [];
    const __where = (e) => ((e.stack || '').split(String.fromCharCode(10))[1] || '').trim();
    const step = Automation.InitSteps.BuildMenu;
    Automation.Menu.DisableFeaturesByDefault = true;
    Automation.Menu.DisableSettingsByDefault = true;

    Automation.Utils.initialize(step);
    Automation.Menu.initialize(step);
    Automation.Menu.addMainAutomationPanel(step);

    for (const name of ${JSON.stringify(MODULES)}) {
        try {
            Automation[name].initialize(step);
            globalThis.__results.push([name, null]);
        } catch (e) {
            globalThis.__results.push([name, e.message, __where(e)]);
        }
    }
})();`;

new vm.Script(code + driver, { filename: 'bundle.js' }).runInContext(ctx);

const results = ctx.__results;
let failures = 0;
console.log('Module init (BuildMenu step):');
for (const [name, err, where] of results) {
    if (err) {
        failures++;
        console.log(`  FAIL  ${name.padEnd(16)} ${err}`);
        if (where) console.log(`                        at ${where}`);
    }
    else { console.log(`  ok    ${name}`); }
}

const d = dom.window.document;
const sections = [...d.querySelectorAll('.automationCardBody .automationCategoryContainer')].map((e) => e.id);
console.log(`\nCard sections: ${sections.join(' | ')}`);
if (sections.length < 5) { failures++; console.log('  FAIL  expected a section per non-floating module'); }

const floating = [...d.querySelectorAll('.automationFloatingCategory')].map((e) => e.id);
console.log(`Inline (floating) panels: ${floating.length ? floating.join(', ') : 'none'}`);

// Every feature toggle must start Off, so nothing runs against a locked feature
const buttons = [...d.querySelectorAll('.automationCardBody span.btn')]
    .filter((b) => b.textContent === 'On' || b.textContent === 'Off');
const on = buttons.filter((b) => b.textContent === 'On').map((b) => b.id);
console.log(`\nFeature toggles rendered: ${buttons.length}`);
if (on.length) { failures++; console.log(`  FAIL  these default to On: ${on.join(', ')}`); }
else { console.log('  ok    all default to Off'); }

// The fossil revive is ours: Farigh's Hatchery has no fossil handling at all, and
// pokeclicker dropped EggType.Fossil in v0.10.24, so retiring enhancedautohatchery
// would otherwise lose the feature entirely.
console.log('');
console.log('Ported fossil revive:');
for (const id of ['Hatchery-ReviveFossils', 'Hatchery-ReviveFossilsUntilShiny']) {
    const present = d.getElementById(id) !== null;
    if (!present) failures++;
    console.log(`  ${present ? 'ok  ' : 'FAIL'}  ${id}`);
}

// Advanced settings used to be a flyout anchored with `right: calc(100% - 10px)`,
// which opened outside its container and got clipped. They must now be in-flow children
// of the feature they belong to.
console.log('');
console.log('Advanced settings disclosure:');
const disclosures = [...d.querySelectorAll('.automation-setting-disclosure')];
const panels = [...d.querySelectorAll('.automation-setting-inline-panel')];
const flyouts = [...d.querySelectorAll('.automation-setting-panel-container')];
const chk = (label, cond) => { if (!cond) failures++; console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}`); };

chk(`disclosures rendered (${disclosures.length})`, disclosures.length >= 8);
chk(`inline panels rendered (${panels.length})`, panels.length === disclosures.length);
chk('no left-opening flyout left over', flyouts.length === 0);
chk('panel is a sibling of its disclosure (in flow)',
    panels.every((panel) => panel.previousElementSibling?.classList.contains('automation-setting-disclosure')));
chk('panels start collapsed', panels.every((p) => !p.hasAttribute('automation-visible')));

// Toggling must open only that panel, and it must stay inside the modal
const first = disclosures.find((el) => el.closest('.automationCardBody'));
first.onclick();
const firstPanel = first.nextElementSibling;
chk('clicking the disclosure expands its panel', firstPanel.hasAttribute('automation-visible'));
chk('expanded panel stays inside the card', firstPanel.closest('.automationCardBody') !== null);
first.onclick();
chk('clicking again collapses it', !firstPanel.hasAttribute('automation-visible'));

// Ported from the Ephenia auto mine: upstream leaves the next mine to the game and only
// warns when the in-game auto restart is off.
console.log('');
console.log('Ported mine picker and treasure selling:');
const picker = d.getElementById('selectedMineType-Underground');
const pchk = (label, cond) => { if (!cond) failures++; console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}`); };
pchk('mine picker rendered', !!picker);
// Six from the game's own 'Find mine' dialog, plus the Mystery Mine, which the game only ever
// reaches by chance and never offers to search for directly.
pchk('offers the six mines the game does, plus the Mystery Mine', picker?.options?.length === 7);
pchk('sell treasures toggle rendered', d.getElementById('Mining-SellTreasures') !== null);
pchk('mega stone hunt toggle rendered', d.getElementById('Mining-HuntMegaStones') !== null);

// Ported from the Ephenia auto clicker, which is the only side that measures anything.
console.log('');
console.log('Ported click statistics:');
for (const id of ['automationClickStats', 'automation-click-efficiency', 'automation-click-rate',
                  'automation-click-required', 'automation-click-enemies']) {
    const present = d.getElementById(id) !== null;
    if (!present) failures++;
    console.log(`  ${present ? 'ok  ' : 'FAIL'}  ${id}`);
}

console.log('');
console.log('Save backup feature:');
for (const id of ['SaveBackup-Enabled', 'SaveBackup-IntervalMinutes', 'SaveBackup-Retention']) {
    const el = d.getElementById(id);
    if (!el) failures++;
    console.log(`  ${el ? 'ok  ' : 'FAIL'}  ${id}${el ? ' (in card: ' + (el.closest('.automationCardBody') !== null) + ')' : ''}`);
}

// A focus topic that runs out of work used to switch the whole feature off. It now hands over to
// the next topic of this chain, and takes over again once its block expires.
console.log('');
console.log('Focus fallback chain:');
const fchk = (label, cond) => { if (!cond) failures++; console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}`); };
const fallbackSelects = [0, 1, 2].map((i) => d.getElementById(`focusFallback-${i}`));
fchk('three ordered fallback slots', fallbackSelects.every((s) => s !== null));
fchk('each defaults to None', fallbackSelects.every((s) => s?.value === ''));

// Exercise the selection directly: driving a real topic into a blocked state would need a
// working game behind it, and the ordering is the part worth pinning down.
new vm.Script(`
;(() => {
    const focus = Automation.Focus;
    const made = (id) => ({ id, name: id, run: () => {}, refreshRateAsMs: 1000 });
    focus.__internal__functionalities = [made('Wanted'), made('First'), made('Second'), made('Locked')];
    focus.__internal__functionalities[3].isUnlocked = () => false;
    Automation.Utils.LocalStorage.setValue(focus.Settings.FallbackOrder, 'Locked,First,Second');
    focus.__internal__wantedTopicId = 'Wanted';

    focus.__internal__blockedTopics.clear();
    globalThis.__fallback = { none: focus.__internal__findBestAvailableTopic()?.id };

    focus.__internal__blockedTopics.set('Wanted', { reason: 'test', blockedAt: Date.now() });
    globalThis.__fallback.skipsLocked = focus.__internal__findBestAvailableTopic()?.id;

    focus.__internal__blockedTopics.set('First', { reason: 'test', blockedAt: Date.now() });
    globalThis.__fallback.second = focus.__internal__findBestAvailableTopic()?.id;

    focus.__internal__blockedTopics.set('Second', { reason: 'test', blockedAt: Date.now() });
    globalThis.__fallback.exhausted = focus.__internal__findBestAvailableTopic();

    // A block expires on its own, which is what brings the chosen topic back
    focus.__internal__blockedTopics.set('Wanted',
        { reason: 'test', blockedAt: Date.now() - focus.__internal__blockedTopicRetryDelayMs - 1 });
    globalThis.__fallback.recovered = focus.__internal__findBestAvailableTopic()?.id;
})();`, { filename: 'fallback.js' }).runInContext(ctx);

const fb = ctx.__fallback;
fchk('the chosen topic wins while it can progress', fb.none === 'Wanted');
fchk('a locked fallback is skipped', fb.skipsLocked === 'First');
fchk('the chain is followed in order', fb.second === 'Second');
fchk('an exhausted chain reports nothing', fb.exhausted === null);
fchk('an expired block returns the chosen topic', fb.recovered === 'Wanted');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
