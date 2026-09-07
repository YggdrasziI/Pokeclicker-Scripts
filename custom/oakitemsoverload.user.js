// ==UserScript==
// @name          [Pokeclicker] Oak Items Overload
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Lets Oak Items be upgraded past their maximum level, from 5 to 10, for a bonus far above the game's own, at a cost that grows out of all proportion. The overloaded levels are kept outside the game save, so the save stays exactly what the unmodified game would write.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.2

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsoverload.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsoverload.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// The overloaded levels come right after the game's own maximum (level 5), one bonus
// per level. Keys are OakItemType names; an item missing from this table keeps the
// game's maximum. The three charms only exist with the Oak Charms script and are
// skipped without it.
const overloadedOakItems = {
    Magic_Ball: [12, 14, 16, 18, 20],
    Amulet_Coin: [1.60, 1.70, 1.80, 1.90, 2.00],
    Rocky_Helmet: [1.60, 1.70, 1.80, 1.90, 2.00],
    Exp_Share: [1.39, 1.48, 1.57, 1.66, 1.75],
    Sprayduck: [1.60, 1.70, 1.80, 1.90, 2.00],
    Shiny_Charm: [2.20, 2.40, 2.60, 2.80, 3.00],
    Magma_Stone: [2.40, 2.80, 3.20, 3.60, 4.00],
    Cell_Battery: [2.30, 2.60, 2.90, 3.20, 3.50],
    Explosive_Charge: [11, 12, 13, 14, 15],
    Treasure_Scanner: [26, 28, 30, 32, 35],
    Quest_Charm: [2.50, 2.75, 3.00, 3.25, 3.50],
    Farm_Charm: [1.70, 1.90, 2.10, 2.30, 2.50],
    Battle_Charm: [2.30, 2.60, 2.90, 3.20, 3.50],
};

// An overloaded level costs the item's last regular upgrade times this, in the same
// currency: 1,000,000 for a regular Oak Item becomes 10M, 50M, 250M, 1B then 5B.
const overloadCostFactors = [10, 50, 250, 1000, 5000];

// The experience needed for an overloaded level is the item's last regular requirement
// times this: 10,000 for a regular Oak Item becomes 30k, 100k, 300k, 1M then 3M.
const overloadExpFactors = [3, 10, 30, 100, 300];

// The Oak Charms script keeps the level of its own items outside the save already;
// only the game's items need their overloaded levels taken out of it.
const oakCharmKeys = ['Quest_Charm', 'Farm_Charm', 'Battle_Charm'];

function overloadedItemsOf(oakItems) {
    return Object.keys(overloadedOakItems)
        .map((key) => oakItems.itemList[OakItemType[key]])
        .filter((item) => item !== undefined && item.overloadBaseMaxLevel !== undefined);
}

// Raises the item's maximum and extends its bonus, cost and experience lists.
// Safe to call again: an item is only extended once.
function overloadOakItem(item, bonusList) {
    if (item.overloadBaseMaxLevel !== undefined) {
        return;
    }
    const baseMaxLevel = item.maxLevel;
    const lastCost = item.costList[baseMaxLevel - 1];
    const lastExp = item.expList[baseMaxLevel - 1];

    item.overloadBaseMaxLevel = baseMaxLevel;
    item.bonusList = item.bonusList.concat(bonusList);
    item.costList = item.costList.concat(
        AmountFactory.createArray(overloadCostFactors.map((factor) => lastCost.amount * factor), lastCost.currency));
    item.expList = item.expList.concat(overloadExpFactors.map((factor) => lastExp * factor));
    item.maxLevel = baseMaxLevel + bonusList.length;
}

function overloadOakItems(oakItems) {
    Object.entries(overloadedOakItems).forEach(([key, bonusList]) => {
        const item = oakItems.itemList[OakItemType[key]];
        if (item !== undefined) {
            overloadOakItem(item, bonusList);
        }
    });
}

// The overloaded levels live outside the game save, per save file, in the browser
// storage: the save keeps the game's own maximum, so a save file or a backup never
// carries a level the unmodified game would not write. The desktop client mirrors
// the store to a small file next to its save backups.
let overloadLoaded = false;
let lastOverloadHandedOver = null;

function overloadStoreKey() {
    return `oakItemsOverload-${Save.key}`;
}

function isOverloadStore(value) {
    return value !== null && typeof value === 'object'
        && Object.values(value).every((entry) => Number.isInteger(entry?.level) && typeof entry?.exp === 'number');
}

function loadOverloadStore() {
    try {
        const stored = JSON.parse(localStorage.getItem(overloadStoreKey()));
        return isOverloadStore(stored) ? stored : null;
    } catch {
        return null;
    }
}

function storeOverload(levels) {
    localStorage.setItem(overloadStoreKey(), JSON.stringify(levels));
}

function currentProfileName() {
    try {
        return JSON.parse(localStorage.getItem(`save${Save.key}`))?.profile?.name ?? null;
    } catch {
        return null;
    }
}

// The desktop client hands over the files found in its save-backups folder as
// DesktopSaveBackupFiles. Only used when this browser profile holds nothing for the
// save: the file for the same save key wins, then one for the same trainer name.
function restoreOverloadFromClient() {
    const files = Object.values(window.DesktopSaveBackupFiles ?? {}).flatMap((contents) => {
        try {
            const parsed = JSON.parse(contents);
            return (parsed?.format === 1 && parsed.kind === 'oakItemsOverload' && isOverloadStore(parsed.levels)) ? [parsed] : [];
        } catch {
            return [];
        }
    });
    const profile = currentProfileName();
    const match = files.find((file) => file.saveKey === Save.key)
        ?? files.find((file) => profile !== null && file.profile === profile);
    return match?.levels ?? null;
}

// Polled by the desktop client's main process, which owns the filesystem. Returns
// null while nothing changed, so the poll costs nothing between level-ups.
function collectOakItemsOverloadBackup() {
    if (!overloadLoaded || !App.game?.oakItems) {
        return null;
    }
    const levels = collectOverloadedLevels(App.game.oakItems);
    const serialized = JSON.stringify(levels);
    if (serialized === lastOverloadHandedOver) {
        return null;
    }
    lastOverloadHandedOver = serialized;

    const profile = App.game.profile.name() || 'Trainer';
    // Keep it filesystem-safe: the trainer name is free text
    const safe = (text) => String(text).replace(/[^\w \-.]/g, '_');
    return {
        filename: `${safe(profile)} [${safe(Save.key || 'default')}] oak-items-overload.json`,
        contents: JSON.stringify({ format: 1, kind: 'oakItemsOverload', saveKey: Save.key, profile, levels }, null, 2),
    };
}

// The level and experience of every game item standing above its regular maximum
function collectOverloadedLevels(oakItems) {
    const levels = {};
    overloadedItemsOf(oakItems).forEach((item) => {
        const key = OakItemType[item.name];
        if (!oakCharmKeys.includes(key) && item.level > item.overloadBaseMaxLevel) {
            levels[key] = { level: item.level, exp: item.toJSON().exp };
        }
    });
    return levels;
}

// Runs on document ready, before the game builds its Oak Item list and reads the
// save. The game clamps a loaded level to the item's maximum, so the maximum has
// to be raised before the save is read.
function initOakItemsOverloadOverrides() {
    if (OakItems.prototype.overloadInstalled) {
        console.warn('Oak Items Overload: already installed, skipping overrides');
        return;
    }
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Oak Items Overload script loaded; the Oak Items cannot be overloaded this session.');
    }
    OakItems.prototype.overloadInstalled = true;

    // Extend the items right after the game builds its list. Items another script adds
    // to the list afterwards (the Oak Charms) are picked up when the save is read.
    const initializeOld = OakItems.prototype.initialize;
    OakItems.prototype.initialize = function (...args) {
        const result = initializeOld.apply(this, args);
        overloadOakItems(this);

        // The game counts its "max level Oak Items" achievements from isMaxLevel(), which an
        // overloaded item only reaches at level 10. Count the game's own maximum instead, and
        // ignore the game's writes, which would count the other way
        this.maxLevelOakItems = ko.pureComputed({
            read: () => this.itemList.filter((item) => item.level >= (item.overloadBaseMaxLevel ?? item.maxLevel)).length,
            write: () => {},
        });
        return result;
    };

    // The save keeps the game's own maximum for the game's items; the overloaded
    // level goes to the side store instead. toJSON runs at every save tick, on
    // download and for backups, which is the cadence wanted for the store.
    const toJSONOld = OakItems.prototype.toJSON;
    OakItems.prototype.toJSON = function (...args) {
        const save = toJSONOld.apply(this, args);
        const levels = collectOverloadedLevels(this);
        Object.keys(levels).forEach((key) => {
            const item = this.itemList[OakItemType[key]];
            save[key].level = item.overloadBaseMaxLevel;
            save[key].exp = item.expList[item.overloadBaseMaxLevel - 1];
        });
        // Game.load() calls toJSON before fromJSON on a brand-new save; never let
        // the defaults overwrite a store that has not been read yet
        if (overloadLoaded) {
            storeOverload(levels);
        }
        return save;
    };

    // An overloaded level is only restored over a save standing at the game's maximum:
    // a save that was levelled down, or another save under the same key, is left alone.
    const fromJSONOld = OakItems.prototype.fromJSON;
    OakItems.prototype.fromJSON = function (json, ...args) {
        overloadOakItems(this);
        const result = fromJSONOld.call(this, json, ...args);
        const stored = loadOverloadStore() ?? restoreOverloadFromClient();
        if (stored) {
            Object.entries(stored).forEach(([key, entry]) => {
                const item = this.itemList[OakItemType[key]];
                if (item?.overloadBaseMaxLevel !== undefined && item.level === item.overloadBaseMaxLevel && entry.level > item.level) {
                    item.fromJSON({ ...item.toJSON(), level: entry.level, exp: entry.exp });
                }
            });
        }
        overloadLoaded = true;
        return result;
    };
}

function initOakItemsOverload() {
    if (overloadedItemsOf(App.game.oakItems).length === 0) {
        throw new Error('The Oak Items were not overloaded; the script probably loaded after the game started.');
    }

    // Only the desktop client can write files; it polls this list from its main process
    if (App.isUsingClient) {
        window.DesktopSaveBackupProviders = window.DesktopSaveBackupProviders ?? [];
        window.DesktopSaveBackupProviders.push(collectOakItemsOverloadBackup);
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

if (!App.isUsingClient || localStorage.getItem('oakitemsoverload') === 'true') {
    loadEpheniaScript('oakitemsoverload', initOakItemsOverload, initOakItemsOverloadOverrides);
}
