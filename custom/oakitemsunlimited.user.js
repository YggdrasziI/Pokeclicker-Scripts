// ==UserScript==
// @name          [Pokeclicker] Oak Items Unlimited
// @namespace     Pokeclicker Scripts
// @author        Ephenia
// @description   Removes the limit for the amount of Oak Items that you're able to equip so that you're able to equip all of them, and lays the equipped Oak Items module out two items per row, with shortened numbers (1.5B), so it stays short with every item equipped.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.1.1

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsunlimited.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsunlimited.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

function initOakItems() {
    var oakItems = App.game.oakItems
    var oakMax = oakItems.itemList.length;
    for (let i = 0; i < oakMax; i++) {
        oakItems.unlockRequirements[i] = 0;
    }
    oakItems.maxActiveCount(oakMax);
    document.getElementById('oakItemsModal').querySelector('h5').innerHTML = "Oak Items Equipped: " + oakItems.activeCount() + '/' + oakMax;
}

// The equipped Oak Items module lists one item per table row: with every item
// equipped it takes most of the column. Lay the rows out two per line, and shorten
// the numbers in the progress bars the way the game's "Shorten currency amount
// shown on main screen" setting does (1,500,000,000 becomes 1.5B), since half a
// row cannot hold "Upgrade (1,500,000,000)". Runs on document ready, before the
// game applies its Knockout bindings: the bindings are rewritten in the template.
function initOakItemsUnlimitedOverrides() {
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Oak Items Unlimited script loaded; the Oak Items module cannot be laid out this session.');
    }
    const container = document.getElementById('oakItemsContainer');
    if (!container) {
        throw new Error('Oak Items Unlimited: the Oak Items module was not found in the page.');
    }

    // The table becomes a two-column grid of rows. A row whose item is not equipped
    // stays in the table, emptied by the "if" binding: hide it so it takes no cell.
    // The stripes would alternate on the hidden rows too, so they go. The icon cell
    // is the game's td.tight, 1 pixel wide so that the table shrinks the column to
    // the icon: in a flex row that pixel is the cell's size and the progress bar
    // covers the icon, so the cell takes its own width back.
    const style = document.createElement('style');
    style.textContent = [
        '#oakItemsBody > table { display: block; }',
        '#oakItemsBody > table > tbody { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }',
        '#oakItemsBody > table > tbody > tr { display: flex; align-items: stretch; }',
        '#oakItemsBody > table > tbody > tr:empty { display: none; }',
        '#oakItemsBody > table > tbody > tr:nth-of-type(odd) { background-color: transparent; }',
        '#oakItemsBody > table > tbody > tr > td.tight { flex: 0 0 auto; width: auto; }',
        '#oakItemsBody > table > tbody > tr > td.p-0 { flex: 1 1 auto; min-width: 0; }',
        '#oakItemsBody > table > tbody .progress span { font-size: 13px !important; white-space: nowrap; }',
        '#oakItemsBody > table > tfoot, #oakItemsBody > table > tfoot > tr, #oakItemsBody > table > tfoot > tr > td { display: block; }',
    ].join('\n');
    document.head.appendChild(style);

    // The progress "2,500 / 5,000" and the "Upgrade (1,000,000 <currency>)" of each row:
    // shorten every number with the game's own formatter. The strings are the game's
    // templates; a template that no longer matches is left as it is.
    const rewrites = [
        ['text: $data.progressString',
            'text: $data.progressString.replace(/[\\d,]+/g, function (n) { return GameConstants.formatNumber(Number(n.replace(/,/g, \'\'))); })'],
        ['$data.calculateCost().amount.toLocaleString(\'en-US\')', 'GameConstants.formatNumber($data.calculateCost().amount)'],
    ];
    let rewritten = 0;
    container.querySelectorAll('tbody span[data-bind]').forEach((span) => {
        const binding = span.getAttribute('data-bind');
        rewrites.forEach(([from, to]) => {
            if (binding.includes(from)) {
                span.setAttribute('data-bind', binding.replace(from, to));
                rewritten++;
            }
        });
    });
    if (rewritten !== rewrites.length) {
        console.warn(`Oak Items Unlimited: ${rewritten} of ${rewrites.length} Oak Items module bindings rewritten, the game's templates may have changed`);
    }
}

function loadEpheniaScript(scriptName, initFunction, priorityFunction) {
    function reportScriptError(scriptName, error) {
        console.error(`Error while initializing '${scriptName}' userscript:\n${error}`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `The '${scriptName}' userscript crashed while loading. Check for updates or disable the script, then restart the game.\n\nReport script issues to the script developer, not to the Pokéclicker team.`,
            timeout: GameConstants.DAY,
        });
    }
    const windowObject = !App.isUsingClient ? unsafeWindow : window;
    // Inject handlers if they don't exist yet
    if (windowObject.epheniaScriptInitializers === undefined) {
        windowObject.epheniaScriptInitializers = {};
        const oldInit = Preload.hideSplashScreen;
        var hasInitialized = false;

        // Initializes scripts once enough of the game has loaded
        Preload.hideSplashScreen = function (...args) {
            var result = oldInit.apply(this, args);
            if (App.game && !hasInitialized) {
                // Initialize all attached userscripts
                Object.entries(windowObject.epheniaScriptInitializers).forEach(([scriptName, initFunction]) => {
                    try {
                        initFunction();
                    } catch (e) {
                        reportScriptError(scriptName, e);
                    }
                });
                hasInitialized = true;
            }
            return result;
        }
    }

    // Prevent issues with duplicate script names
    if (windowObject.epheniaScriptInitializers[scriptName] !== undefined) {
        console.warn(`Duplicate '${scriptName}' userscripts found!`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `Duplicate '${scriptName}' userscripts detected. This could cause unpredictable behavior and is not recommended.`,
            timeout: GameConstants.DAY,
        });
        let number = 2;
        while (windowObject.epheniaScriptInitializers[`${scriptName} ${number}`] !== undefined) {
            number++;
        }
        scriptName = `${scriptName} ${number}`;
    }
    // Add initializer for this particular script
    windowObject.epheniaScriptInitializers[scriptName] = initFunction;
    // Run any functions that need to execute before the game starts
    if (priorityFunction) {
        $(document).ready(() => {
            try {
                priorityFunction();
            } catch (e) {
                reportScriptError(scriptName, e);
                // Remove main initialization function  
                windowObject.epheniaScriptInitializers[scriptName] = () => null;
            }
        });
    }
}

if (!App.isUsingClient || localStorage.getItem('oakitemsunlimited') === 'true') {
    loadEpheniaScript('oakitemsunlimited', initOakItems, initOakItemsUnlimitedOverrides);
}
