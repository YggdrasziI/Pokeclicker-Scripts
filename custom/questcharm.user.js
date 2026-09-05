// ==UserScript==
// @name          [Pokeclicker] Quest Charm
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Adds a thirteenth Oak Item, the Quest Charm, that multiplies the Quest Points you gain from quests (×1.25 to ×1.50 across its levels, like the Amulet Coin does for money). Unlocked on reaching Johto, levelled by claiming quests.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.1

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/questcharm.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/questcharm.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// Enum key of the new item. It is also the key under which the game saves it,
// so it must never change once released.
const questCharmKey = 'Quest_Charm';
// The game has no assets/images/oakitems/Quest_Charm.png; this replaces it.
const questCharmIcon = 'assets/images/currency/questPoint.svg';

// Runs on document ready, before the game builds its Oak Item list and applies
// its Knockout bindings. Everything that changes what the game *constructs*
// has to happen here.
function initQuestCharmOverrides() {
    if (OakItemType[questCharmKey] !== undefined) {
        console.warn('Quest Charm: Oak Item already registered, skipping overrides');
        return;
    }
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Quest Charm script loaded; the Oak Item cannot be added this session.');
    }

    // Extend the OakItemType enum in both directions, like a TypeScript enum.
    // OakItems.toJSON keys the save by OakItemType[item.name], and fromJSON only
    // reads the enum's names, so both mappings are needed for the item to persist.
    const questCharmIndex = Object.keys(OakItemType).filter((key) => Number.isNaN(Number(key))).length;
    OakItemType[questCharmIndex] = questCharmKey;
    OakItemType[questCharmKey] = questCharmIndex;

    class QuestCharm extends OakItem {
        constructor() {
            super(OakItemType[questCharmKey], 'Quest Charm', 'Gain more Quest Points from quests',
                true, [1.25, 1.30, 1.35, 1.40, 1.45, 1.50], 1, 0, 1, [10, 100, 250, 500, 1000]);
        }

        // The base class unlocks on unique pokémon caught; this one unlocks on reaching Johto.
        isUnlocked() {
            return player.highestRegion() >= GameConstants.Region.johto;
        }

        getHint() {
            return 'Reach the Johto region';
        }

        get hint() {
            return ko.pureComputed(() => this.getHint());
        }
    }

    // Add the item right after the game builds its own list, before Game.load()
    // reads the save and before Knockout renders the (non-observable) list.
    const initializeOld = OakItems.prototype.initialize;
    OakItems.prototype.initialize = function (...args) {
        const result = initializeOld.apply(this, args);
        if (this.itemList[OakItemType[questCharmKey]] === undefined) {
            this.itemList[OakItemType[questCharmKey]] = new QuestCharm();
        }
        return result;
    };

    // Every quest point gain goes through Wallet.addAmount -> calcBonus, which
    // returns 1 for quest points in the base game. Asking the Oak Item for its
    // bonus with useItem = true also feeds it exp, exactly like the Amulet Coin.
    // addAmount skips calcBonus entirely when ignoreBonus is set, so flat
    // questline rewards stay flat.
    const calcBonusOld = Wallet.prototype.calcBonus;
    Wallet.prototype.calcBonus = function (amount, ...args) {
        if (amount?.currency === GameConstants.Currency.questPoint && App.game?.oakItems) {
            return App.game.oakItems.calculateBonus(OakItemType[questCharmKey], true);
        }
        return calcBonusOld.call(this, amount, ...args);
    };

    // The Oak Item grids break their rows every 4 items, and a Bootstrap .col alone
    // on its row takes the full width, so the 13th tile came out four times too big.
    // Pinning every tile to a quarter row changes nothing for the full rows.
    const style = document.createElement('style');
    style.textContent = '#oakItemsModal ul.row > li.col { flex: 0 0 25%; max-width: 25%; }';
    document.head.appendChild(style);

    // The Oak Item templates build the image path from the enum key. Image error
    // events do not bubble, so catch them in the capture phase and swap the icon.
    document.addEventListener('error', (event) => {
        const target = event.target;
        if (target?.tagName === 'IMG' && target.src.endsWith(`oakitems/${questCharmKey}.png`)) {
            target.src = questCharmIcon;
        }
    }, true);
}

function initQuestCharm() {
    if (App.game.oakItems.itemList[OakItemType[questCharmKey]] === undefined) {
        throw new Error('The Quest Charm Oak Item was not added to the game; the script probably loaded after the game started.');
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

if (!App.isUsingClient || localStorage.getItem('questcharm') === 'true') {
    loadEpheniaScript('questcharm', initQuestCharm, initQuestCharmOverrides);
}
