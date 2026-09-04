// Exercises the rewritten Menu host layer against a DOM that mimics the parts of
// Pokeclicker's markup the adapter attaches to: the right column that holds the game's
// own modules, and an in-game modal for floating categories.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { makeGameStub } from './gamestub.mjs';

const BUNDLE = new URL('../../pokeclickerautomation.user.js', import.meta.url);

// Mirrors the game's right column, with a couple of real modules already in place
const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="game" class=""></div>
  <div id="left-column" class="col-12"><div id="battleContainer" class="card"></div></div>
  <div id="right-column" class="col-12">
    <div id="oakItemsContainer" class="card sortable border-secondary mb-3"></div>
    <div id="questDisplayContainer" class="card sortable border-secondary mb-3"></div>
    <div id="farmDisplay" class="card sortable border-secondary mb-3"></div>
  </div>
  <div id="fakeIngameModal"></div>
</body></html>`);

const { window } = dom;

// The card must land where the player last dragged it: between the quest and farm modules.
const STORED_ORDER = 'oakItemsContainer|questDisplayContainer|automationDisplayContainer|farmDisplay';

const ctx = makeGameStub(window);
// The card replays its own placement from this setting, since the game sorts its modules
// before userscripts get to run
// A card the player dragged into another column, which 'Full width 5 columns' makes reachable
const LEFT_ORDER = 'battleContainer|movedDisplayContainer';
ctx.Settings = {
    getSetting: (name) => ({
        observableValue: () => {
            if (name === 'modules.right-column') return STORED_ORDER;
            if (name === 'modules.left-column') return LEFT_ORDER;
            return '';
        },
    }),
};

ctx.window = ctx;
vm.createContext(ctx);

const code = await readFile(BUNDLE, 'utf8');
const driver = `
;(() => {
    const step = Automation.InitSteps.BuildMenu;
    // Automation.start normally sets these before driving the init steps
    Automation.Menu.DisableFeaturesByDefault = true;
    Automation.Menu.DisableSettingsByDefault = true;

    Automation.Utils.initialize(step);
    Automation.Menu.initialize(step);
    Automation.Menu.addMainAutomationPanel(step);
    Automation.Underground.initialize(step);
    Automation.Notifications.initialize(step);

    // A second category, to check that categories stack as sections
    Automation.Menu.addCategory("automationTrivia", "Trivia");

    // A card whose stored position is in a different column than the one it is appended to
    Automation.Menu.createCard("movedDisplayContainer", "Moved");

    // A floating category must stay OUT of the card and attach to the in-game modal
    Automation.Menu.addFloatingCategory("automationFarmingModal", "Farming",
                                        document.getElementById("fakeIngameModal"));
})();`;

new vm.Script(code + driver, { filename: 'bundle.js' }).runInContext(ctx);

// ---- assertions -----------------------------------------------------------
const d = window.document;
let failures = 0;
const check = (label, cond, extra = '') => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
    if (!cond) failures++;
};

const card = d.getElementById('automationDisplayContainer');
check('Automation card created', !!card);
check('card uses the game module classes', !!card
      && ['card', 'sortable', 'border-secondary', 'mb-3'].every((c) => card.classList.contains(c)));
check('card is docked in the right column', card?.parentElement?.id === 'right-column');

const header = card?.querySelector('.card-header');
check('card has a header (the drag handle)', !!header);
check('header collapses the body', header?.getAttribute('data-toggle') === 'collapse'
      && header?.getAttribute('href') === '#automationDisplayContainerBody');
const body = d.querySelector('#automationDisplayContainer .automationCardBody');
check('card body present and shown', !!body && body.classList.contains('show'));

// The game sorts its modules before userscripts run, so the card has to replay its own placement
const ids = [...d.querySelectorAll('#right-column > .card')].map((e) => e.id);
check('card restored to its stored position', ids.join('|') === STORED_ORDER, `(${ids.join(', ')})`);

// Categories are collapsible sections now, not tabs
const categories = [...body.querySelectorAll('.automationCategoryContainer')];
check('categories added as sections', categories.length === 2,
      `(${categories.map((c) => c.id).join(', ')})`);
const title = categories[0]?.querySelector('.automationCategoryTitle');
check('category has a clickable title', !!title && typeof title.onclick === 'function');
const content = categories[0]?.querySelector('.automationCategory');
check('category starts expanded', !!content && !content.classList.contains('hide'));
title.onclick();
check('clicking the title collapses it', content.classList.contains('hide'));
title.onclick();
check('clicking again expands it', !content.classList.contains('hide'));

// Nothing modal-shaped should be left over
check('no Automation modal left', d.getElementById('automationModal') === null);
check('no floating overlay container left', d.getElementById('automationContainer') === null);

// The Mining button must sit in the card, with the nesting addSettingPanel relies on
const miningBtn = d.getElementById('Mining-Enabled');
check('Mining button rendered', !!miningBtn);
check('Mining button lives inside the card', !!miningBtn?.closest('.automationCardBody'));
check('button nesting preserved for addSettingPanel',
      miningBtn?.parentElement?.parentElement?.tagName === 'SPAN');
check('feature defaults to Off (disableFeaturesByDefault)',
      miningBtn?.textContent === 'Off', `(got "${miningBtn?.textContent}")`);

// --- floating category stays inline on the in-game modal ---
const floating = d.getElementById('automationFarmingModal');
check('floating category attached to the in-game modal',
      !!floating && floating.closest('#fakeIngameModal') !== null);
check('floating category is NOT in the card',
      !!floating && floating.closest('.automationCardBody') === null);
check('floating category keeps the panel chrome',
      !!floating && floating.classList.contains('automationFloatingCategory'));

// The game sorts across six columns, not just the one we append to. A card dragged elsewhere
// used to come back to the wrong column on the next launch.
const moved = d.getElementById('movedDisplayContainer');
check('a card stored in another column is moved there',
      moved?.parentElement?.id === 'left-column', `(in ${moved?.parentElement?.id})`);
check('and lands after its stored predecessor',
      moved?.previousElementSibling?.id === 'battleContainer');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
