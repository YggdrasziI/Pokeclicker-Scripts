// ==UserScript==
// @name          [Pokeclicker] Oak Items Overload
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Lets Oak Items be upgraded past their maximum level, from 5 to 10, for a bonus far above the game's own, at a cost that grows out of all proportion. The overloaded levels are kept outside the game save, so the save stays exactly what the unmodified game would write.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.2.1

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsoverload.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakitemsoverload.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// The overloaded levels come right after the game's own maximum (level 5), one entry
// per level in each list. Keys are OakItemType names; an item missing from this table
// keeps the game's maximum. Every value is written by hand, per item, on the item's
// own scale:
//   bonusList: the bonus at each overloaded level
//   expList:   the experience needed in total to buy each level, like the game's own
//              expList (the game asks 10,000 in total for level 5, the Cell Battery 150)
//   costList:  the price of each level, in the currency of the item's regular upgrades
const overloadedOakItems = {
    Magic_Ball: {
        bonusList: [12, 14, 16, 18, 20],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Amulet_Coin: {
        bonusList: [1.60, 1.70, 1.80, 1.90, 2.00],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Rocky_Helmet: {
        bonusList: [1.60, 1.70, 1.80, 1.90, 2.00],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Exp_Share: {
        bonusList: [1.39, 1.48, 1.57, 1.66, 1.75],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Sprayduck: {
        bonusList: [1.60, 1.70, 1.80, 1.90, 2.00],
        expList: [30000, 100000, 150000, 200000, 300000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Shiny_Charm: {
        bonusList: [2.20, 2.40, 2.60, 2.80, 3.00],
        expList: [30000, 100000, 300000, 1000000, 2000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Magma_Stone: {
        bonusList: [2.40, 2.80, 3.20, 3.60, 4.00],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Cell_Battery: {
        bonusList: [2.30, 2.60, 2.90, 3.20, 3.50],
        expList: [450, 1000, 2000, 3500, 8000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
    Explosive_Charge: {
        bonusList: [11, 12, 13, 14, 15],
        expList: [30000, 100000, 300000, 1000000, 3000000],
        costList: [20000000, 100000000, 500000000, 2000000000, 10000000000],
    },
    Treasure_Scanner: {
        bonusList: [26, 28, 30, 32, 35],
        expList: [10000, 20000, 30000, 50000, 80000],
        costList: [10000000, 50000000, 250000000, 1000000000, 5000000000],
    },
};

function overloadedItemsOf(oakItems) {
    return Object.keys(overloadedOakItems)
        .map((key) => oakItems.itemList[OakItemType[key]])
        .filter((item) => item !== undefined && item.overloadBaseMaxLevel !== undefined);
}

// Raises the item's maximum and extends its bonus, cost and experience lists with the
// table entry. Safe to call again: an item is only extended once.
function overloadOakItem(item, overload) {
    if (item.overloadBaseMaxLevel !== undefined) {
        return;
    }
    const baseMaxLevel = item.maxLevel;
    const lastCost = item.costList[baseMaxLevel - 1];

    item.overloadBaseMaxLevel = baseMaxLevel;
    item.bonusList = item.bonusList.concat(overload.bonusList);
    item.costList = item.costList.concat(AmountFactory.createArray(overload.costList, lastCost.currency));
    item.expList = item.expList.concat(overload.expList);
    item.maxLevel = baseMaxLevel + overload.bonusList.length;
}

function overloadOakItems(oakItems) {
    Object.entries(overloadedOakItems).forEach(([key, overload]) => {
        const item = oakItems.itemList[OakItemType[key]];
        if (item !== undefined) {
            overloadOakItem(item, overload);
        }
    });
}

// The table is written by hand: a level with a bonus but no price or no experience
// would break the game's upgrade path, so refuse to install rather than half-extend.
function checkOverloadTable() {
    Object.entries(overloadedOakItems).forEach(([key, overload]) => {
        const lists = [overload.bonusList, overload.expList, overload.costList];
        if (!lists.every((list) => Array.isArray(list) && list.length > 0 && list.length === overload.bonusList.length)) {
            throw new Error(`Oak Items Overload: ${key} needs bonusList, expList and costList of the same length.`);
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
        if (item.level > item.overloadBaseMaxLevel) {
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
    checkOverloadTable();
    OakItems.prototype.overloadInstalled = true;

    // Extend the items right after the game builds its list, before the save is read.
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
