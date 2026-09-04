// Exercises the conflict bridges: enabling a feature on one side must offer to switch off the
// incompatible feature on the other, in both directions.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { makeGameStub } from './gamestub.mjs';

const BUNDLE = new URL('../../pokeclickerautomation.user.js', import.meta.url);

// Stand-ins for the Ephenia buttons the bridges watch. Those scripts all show their state
// through the bootstrap button colour, which is what the bridge reads.
const EPHENIA_BUTTONS = ['auto-click-start', 'auto-gym-start', 'auto-dungeon-start',
                         'toggle-auto-quest', 'auto-hatch-start', 'auto-mine-start',
                         'auto-plant-toggle', 'auto-harvest-toggle', 'auto-replant-toggle',
                         'auto-mulch-toggle'];

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="game" class=""></div>
  <div id="right-column" class="col-12"></div>
  <div id="battleCafeModal"></div>
  <div id="farmModal"></div>
  <div id="settings-scripts">
    <div id="settings-scripts-container">
      <table><thead><tr><th colspan="2">Additional Visual Settings</th></tr></thead>
        <tbody id="settings-scripts-additionalvisualetting"><tr><td>Hide attack</td><td><input id="avs-opt" type="checkbox"></td></tr></tbody></table>
      <table><thead><tr><th colspan="2">Auto Quest Completer</th></tr></thead>
        <tbody id="settings-scripts-autoquestcompleter"><tr><td>Quest slots</td><td><input id="input-auto" type="text"></td></tr></tbody></table>
    </div>
    <table id="desktopScriptSettings"><thead><tr><th colspan="2">Downloaded scripts</th></tr></thead>
      <tbody id="settings-scripts-enableScriptsEphenia"></tbody></table>
  </div>
  <div id="townMap">
    <select id="change-time-select" style="position: absolute; right: 190px;"><option value="-1">PC Time</option></select>
    <select id="change-weather-select" style="position: absolute; right: 100px;"><option value="-1">Default Weather</option></select>
  </div>
  <div id="epheniaButtons">
    ${EPHENIA_BUTTONS.map((id) => `<button id="${id}" class="btn btn-danger"></button>`).join('\n    ')}
  </div>
</body></html>`);

// The real scripts flip their button's colour from their own click handler. Reproduce that,
// so the bridge's simulated click actually turns the feature off, and so the capture-phase
// interception has a target-phase handler to hold back.
for (const id of EPHENIA_BUTTONS) {
    const button = dom.window.document.getElementById(id);
    button.addEventListener('click', () => {
        const wasOn = button.classList.contains('btn-success');
        button.classList.remove(wasOn ? 'btn-success' : 'btn-danger');
        button.classList.add(wasOn ? 'btn-danger' : 'btn-success');
    });
}

const ctx = makeGameStub(dom.window);

// Record what the confirm dialog was asked, and answer whatever the test wants
let confirmCalls = [];
let confirmAnswer = true;
ctx.Notifier = {
    notify() {},
    confirm: (opts) => { confirmCalls.push(opts); return Promise.resolve(confirmAnswer); },
};

vm.createContext(ctx);
const code = await readFile(BUNDLE, 'utf8');

const driver = `
;(() => {
    const build = Automation.InitSteps.BuildMenu;
    Automation.Menu.DisableFeaturesByDefault = true;
    Automation.Menu.DisableSettingsByDefault = true;

    Automation.Utils.initialize(build);
    Automation.Menu.initialize(build);
    Automation.Menu.addMainAutomationPanel(build);
    for (const name of ['Click', 'Focus', 'Hatchery', 'Underground', 'Farm', 'Shop', 'Items',
                        'Notifications', 'Trivia', 'Gym', 'Dungeon', 'BattleFrontier', 'BattleCafe']) {
        Automation[name].initialize(build);
    }

    // Bridges install on the Finalize step
    Automation.Bridges.initialize(Automation.InitSteps.Finalize);
    Automation.EpheniaControls.initialize(Automation.InitSteps.Finalize);
    Automation.Menu.buildFeatureGroups();

    // Top-level class bindings aren't globalThis properties, hand it to the test
    globalThis.Automation = Automation;
})();`;

new vm.Script(code + driver, { filename: 'bundle.js' }).runInContext(ctx);

const d = dom.window.document;
let failures = 0;
const check = (label, cond, extra = '') => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
    if (!cond) failures++;
};
const flush = () => new Promise((r) => setImmediate(r));

const setEphenia = (id, on) => {
    const b = d.getElementById(id);
    b.classList.remove(on ? 'btn-danger' : 'btn-success');
    b.classList.add(on ? 'btn-success' : 'btn-danger');
};
const epheniaOn = (id) => d.getElementById(id).classList.contains('btn-success');
const automationOn = (s) => ctx.Automation.Utils.LocalStorage.getValue(s) === 'true';

// --- the matrix must point at buttons that actually exist -------------------
console.log('Conflict matrix:');
const conflicts = ctx.Automation.Bridges.Conflicts;
const missing = conflicts.flatMap((c) => c.ephenia.map((e) => e.id))
    .filter((id) => !EPHENIA_BUTTONS.includes(id));
check(`${conflicts.length} pairs declared`, conflicts.length >= 7);
check('every pair targets a known Ephenia button', missing.length === 0, missing.join(', '));
check('Battle Frontier is not treated as a conflict',
      !conflicts.some((c) => c.automationSetting.startsWith('BattleFrontier')));

// --- direction 1: turning an automation feature on -------------------------
console.log('\nAutomation -> Ephenia:');
setEphenia('auto-mine-start', true);
confirmCalls = []; confirmAnswer = true;
d.getElementById('Mining-Enabled').click();
await flush();
check('confirmation was requested', confirmCalls.length === 1);
check('the dialog names the Ephenia feature',
      confirmCalls[0]?.message?.includes('Auto Mine') === true);
check("Ephenia's auto mine was switched off", !epheniaOn('auto-mine-start'));
check('the automation feature is now on', automationOn('Mining-Enabled'));

// --- cancelling must leave both sides untouched ----------------------------
console.log('\nCancelling:');
ctx.Automation.Menu.forceAutomationState('Hatchery-Enabled', false);
setEphenia('auto-hatch-start', true);
confirmCalls = []; confirmAnswer = false;
d.getElementById('Hatchery-Enabled').click();
await flush();
check('confirmation was requested', confirmCalls.length === 1);
check("Ephenia's hatchery is still on", epheniaOn('auto-hatch-start'));
check('the automation feature stayed off', !automationOn('Hatchery-Enabled'));

// --- no conflict means no dialog -------------------------------------------
console.log('\nNo conflict:');
setEphenia('auto-click-start', false);
confirmCalls = [];
d.getElementById('Click-Enabled').click();
await flush();
check('no dialog shown', confirmCalls.length === 0);
check('the feature toggled straight away', automationOn('Click-Enabled'));

// --- direction 2: turning an Ephenia feature on ----------------------------
console.log('\nEphenia -> Automation:');
// 'Click-Enabled' is on from the previous step
confirmCalls = []; confirmAnswer = true;
d.getElementById('auto-click-start').click();
await flush();
check('confirmation was requested', confirmCalls.length === 1);
check('the dialog names the automation feature',
      confirmCalls[0]?.message?.includes('Auto attack') === true);
check('the automation feature was switched off', !automationOn('Click-Enabled'));
check('the Ephenia click was let through afterwards', epheniaOn('auto-click-start'));

// --- Focus conflicts with several Ephenia features at once -----------------
console.log('\nFocus (multiple conflicts):');
setEphenia('auto-gym-start', true);
setEphenia('auto-dungeon-start', true);
setEphenia('toggle-auto-quest', true);
confirmCalls = []; confirmAnswer = true;
d.getElementById('Focus-Enabled').click();
await flush();
check('a single dialog listed them all', confirmCalls.length === 1);
check('all three were named',
      ['Auto Gym', 'Auto Dungeon', 'Auto Quest Completer']
          .every((n) => confirmCalls[0]?.message?.includes(n)));
check('all three were switched off',
      !epheniaOn('auto-gym-start') && !epheniaOn('auto-dungeon-start') && !epheniaOn('toggle-auto-quest'));

// --- the Ephenia switches mirrored into the card ---------------------------
console.log('');
console.log('Ephenia controls mirrored in their own card:');
const epheniaCard = d.getElementById('epheniaDisplayContainer');
check('Ephenia gets its own card', !!epheniaCard);
check('it is docked in the right column', epheniaCard?.parentElement?.id === 'right-column');
check('it is separate from the Automation card',
      !!epheniaCard && epheniaCard !== d.getElementById('automationDisplayContainer'));
// One collapsible section per script, so each can be folded away independently. The
// Time and weather section is checked further down: it holds relocated dropdowns, not mirrors.
const mirrorSections = [...(epheniaCard?.querySelectorAll('.automationCategoryContainer[id^="epheniaControls-"]') ?? [])]
    .filter((section) => section.id !== 'epheniaControls-TimeAndWeatherDiv'
                      && section.querySelector('[id^="ephenia-mirror-"]') !== null);
check(`a mirror section per script (${mirrorSections.length})`, mirrorSections.length === 5);
check('no Ephenia section leaked into the Automation card',
      d.querySelector('#automationDisplayContainer [id^="epheniaControls-"]') === null);

const mirrors = [...d.querySelectorAll('[id^="ephenia-mirror-"]')];
check(`a mirror per available switch (${mirrors.length})`, mirrors.length === EPHENIA_BUTTONS.length);

// 'auto-safari-toggle' is not in the test DOM, so it must not get a row
check('missing buttons get no row', d.getElementById('ephenia-mirror-auto-safari-toggle') === null);

// State is copied from the real button
setEphenia('auto-harvest-toggle', false);
const harvestMirror = d.getElementById('ephenia-mirror-auto-harvest-toggle');
check('mirror shows Off when the feature is off', harvestMirror.textContent === 'Off');

// Toggling from the original control updates the mirror (MutationObserver)
setEphenia('auto-harvest-toggle', true);
await flush();
check('mirror follows the original control', harvestMirror.textContent === 'On',
      `(got "${harvestMirror.textContent}")`);

// Using the mirror drives the real button
harvestMirror.onclick();
await flush();
check('clicking the mirror toggles the real feature', !epheniaOn('auto-harvest-toggle'));
check('mirror caught up', harvestMirror.textContent === 'Off');

// And the mirror goes through the bridge, so conflicts are still caught
ctx.Automation.Menu.forceAutomationState('Mining-Enabled', true);
setEphenia('auto-mine-start', false);
confirmCalls = []; confirmAnswer = false;
d.getElementById('ephenia-mirror-auto-mine-start').onclick();
await flush();
check('the bridge intercepts a mirror click too', confirmCalls.length === 1);
check('cancelling left the feature off', !epheniaOn('auto-mine-start'));

// Every module dumps its controls into the one 'Automation' category, which is unusable once
// expanded. Each block gets its own fold.
console.log('');
console.log('Foldable feature groups:');
const groups = [...d.querySelectorAll('.automationFeatureGroup')];
const titles = groups.map((g) => g.querySelector('.automationFeatureGroupTitle')?.textContent);
check(`a group per module (${groups.length})`, groups.length >= 8, titles.join(', '));
check('every group is named', titles.every((t) => t && t.length > 0));
// createTitleElement also titles the advanced settings panels; those are not the block's name
check('no group named after an advanced settings panel',
      !titles.some((t) => t.includes('advanced settings')), titles.join(', '));
check('Focus is named after its own title, not a switch', titles.includes('Focus on'));
check('groups start folded', groups.every((g) => g.querySelector('.automationFeatureGroupTitle + div')?.classList.contains('hide')));

const firstGroup = groups[0];
const firstHeader = firstGroup.querySelector('.automationFeatureGroupTitle');
const firstBody = firstHeader.nextElementSibling;
firstHeader.onclick();
check('clicking a header unfolds it', !firstBody.classList.contains('hide'));
firstHeader.onclick();
check('clicking again folds it', firstBody.classList.contains('hide'));

// Those settings live in a tab of the game's settings modal, which is the round trip the card
// is meant to remove. They are moved, not copied, so their handlers come along.
console.log('');
// The settings tables were relocated into the card at one point. They are deliberately left in
// the game's Settings > Scripts tab now, which is where every other script setting lives.
console.log('Script settings left in the settings modal:');
const avsInput = d.getElementById('avs-opt');
const questInput = d.getElementById('input-auto');
check('no settings section in the card',
      d.querySelector('[id^="epheniaSettings-"]') === null);
check('AVS settings stayed in the modal', avsInput?.closest('.automationCardBody') === null);
check('Auto Quest slot count stayed in the modal', questInput?.closest('.automationCardBody') === null);
check('both tables are still in the scripts container',
      d.querySelectorAll('#settings-scripts-container table').length === 2);
check('their headings were left intact',
      d.querySelectorAll('#settings-scripts-container thead').length === 2);
// The client's own script manager stays where its documentation points people
check('desktop client settings were left alone',
      d.getElementById('desktopScriptSettings')?.closest('.automationCardBody') === null
   && d.getElementById('settings-scripts-enableScriptsEphenia') !== null);

// The weather and time scripts drop their dropdown onto the town map rather than registering a
// settings table, so they need a relocation path of their own.
console.log('');
console.log('World map dropdowns relocated into the card:');
const timeSelect = d.getElementById('change-time-select');
const weatherSelect = d.getElementById('change-weather-select');
check('a Time and weather section', d.getElementById('epheniaControls-TimeAndWeather') !== null);
check('the hour dropdown moved into the card', timeSelect?.closest('.automationCardBody') !== null);
check('the weather dropdown moved into the card', weatherSelect?.closest('.automationCardBody') !== null);
check('they left the town map behind', d.querySelector('#townMap select') === null);
// They were absolutely positioned in a corner of the map, which makes no sense inside a card
check('the map positioning was neutralized',
      timeSelect?.style.position === 'static' && weatherSelect?.style.position === 'static');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
