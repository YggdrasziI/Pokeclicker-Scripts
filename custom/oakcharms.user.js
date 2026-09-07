// ==UserScript==
// @name          [Pokeclicker] Oak Charms
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Adds three Oak Items to the game's own Oak Items window: the Quest Charm, Farm Charm and Battle Charm multiply the Quest Points, Farm Points and Battle Points you gain, the way the Amulet Coin multiplies money. Each unlocks on its own condition and levels up by using it.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.2.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakcharms.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakcharms.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// One entry per added Oak Item. The order is the order of their enum values and
// of their tiles, and 'key' is the name they are saved under: never reorder or
// rename an entry once released.
//   currency:  the wallet currency the charm multiplies
//   expOnGain: exp granted when that currency is gained (base amount, bonus applied)
//   icon:      replaces the missing assets/images/oakitems/<key>.png
const oakCharms = [
    {
        key: 'Quest_Charm',
        displayName: 'Quest Charm',
        description: 'Gain more Quest Points from quests',
        bonusList: [1.15, 1.25, 1.5, 1.75, 2.00, 2.25],
        expList: [10, 100, 250, 500, 1000],
        costList: [1000000, 2500000, 5000000, 10000000, 20000000],
        currency: 'questPoint',
        // One exp per quest reward, whatever its size
        expOnGain: () => 1,
        isUnlocked: () => player.highestRegion() >= GameConstants.Region.johto,
        hint: 'Reach the Johto region',
        icon: 'assets/images/currency/questPoint.svg',
    },
    {
        key: 'Farm_Charm',
        displayName: 'Farm Charm',
        description: 'Gain more Farm Points from harvesting',
        bonusList: [1.25, 1.30, 1.35, 1.40, 1.45, 1.50],
        expList: [1000, 10000, 25000, 100000, 250000],
        costList: [75000, 150000, 375000, 750000, 1500000],
        currency: 'farmPoint',
        // One exp per Farm Point actually received
        expOnGain: (base, bonus) => Math.floor(base * bonus),
        isUnlocked: () => App.game.farming.unlockedBerries.filter((unlocked) => unlocked()).length >= 5,
        hint: 'Unlock 5 berries',
        icon: 'assets/images/currency/farmPoint.svg',
    },
    {
        key: 'Battle_Charm',
        displayName: 'Battle Charm',
        description: 'Gain more Battle Points from the Battle Frontier',
        bonusList: [1.25, 1.35, 1.50, 1.60, 1.75, 2.00],
        expList: [500, 1000, 2500, 5000, 25000],
        costList: [10000000, 25000000, 50000000, 100000000, 500000000],
        currency: 'battlePoint',
        // Exp comes from stages completed instead, see the BattleFrontierRunner hook
        expOnGain: () => 0,
        isUnlocked: () => App.game.party.alreadyCaughtPokemonByName('Deoxys'),
        hint: 'Obtain Deoxys at stage 100 of the Battle Frontier',
        icon: 'assets/images/currency/battlePoint.svg',
    },
];

function oakCharmItem(charm) {
    return App.game.oakItems.itemList[OakItemType[charm.key]];
}

// The charm progress (level, exp, equipped) lives outside the game save, so a save
// file or a backup never carries anything the unmodified game would not write.
// It is kept per save file in the browser storage, like the game's own save, and
// the desktop client mirrors it to a small file next to its save backups.
let charmsLoaded = false;
let lastCharmsHandedOver = null;

function charmProgressKey() {
    return `oakCharms-${Save.key}`;
}

function isCharmProgress(value) {
    return value !== null && typeof value === 'object'
        && oakCharms.some((charm) => value[charm.key] !== undefined);
}

function loadCharmProgress() {
    try {
        const stored = JSON.parse(localStorage.getItem(charmProgressKey()));
        return isCharmProgress(stored) ? stored : null;
    } catch {
        return null;
    }
}

function storeCharmProgress(charms) {
    localStorage.setItem(charmProgressKey(), JSON.stringify(charms));
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
// save, which is what happens after importing a backup into a fresh install: the
// file for the same save key wins, then one for the same trainer name.
function restoreCharmProgressFromClient() {
    const files = Object.values(window.DesktopSaveBackupFiles ?? {}).flatMap((contents) => {
        try {
            const parsed = JSON.parse(contents);
            return (parsed?.format === 1 && isCharmProgress(parsed.charms)) ? [parsed] : [];
        } catch {
            return [];
        }
    });
    const profile = currentProfileName();
    const match = files.find((file) => file.saveKey === Save.key)
        ?? files.find((file) => profile !== null && file.profile === profile);
    return match?.charms ?? null;
}

// Polled by the desktop client's main process, which owns the filesystem. Returns
// null while nothing changed, so the poll costs nothing between charm level-ups.
function collectOakCharmsBackup() {
    if (!charmsLoaded || !App.game?.oakItems) {
        return null;
    }
    const charms = {};
    oakCharms.forEach((charm) => {
        charms[charm.key] = oakCharmItem(charm).toJSON();
    });
    const serialized = JSON.stringify(charms);
    if (serialized === lastCharmsHandedOver) {
        return null;
    }
    lastCharmsHandedOver = serialized;

    const profile = App.game.profile.name() || 'Trainer';
    // Keep it filesystem-safe: the trainer name is free text
    const safe = (text) => String(text).replace(/[^\w \-.]/g, '_');
    return {
        filename: `${safe(profile)} [${safe(Save.key || 'default')}] oak-charms.json`,
        contents: JSON.stringify({ format: 1, saveKey: Save.key, profile, charms }, null, 2),
    };
}

// Runs on document ready, before the game builds its Oak Item list and applies
// its Knockout bindings. Everything that changes what the game *constructs*
// has to happen here.
function initOakCharmsOverrides() {
    if (OakItemType[oakCharms[0].key] !== undefined) {
        console.warn('Oak Charms: Oak Items already registered, skipping overrides');
        return;
    }
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Oak Charms script loaded; the Oak Items cannot be added this session.');
    }

    // Extend the OakItemType enum in both directions, like a TypeScript enum.
    // OakItems.toJSON keys the save by OakItemType[item.name], and fromJSON only
    // reads the enum's names, so both mappings are needed for the items to persist.
    let nextIndex = Object.keys(OakItemType).filter((key) => Number.isNaN(Number(key))).length;
    oakCharms.forEach((charm) => {
        OakItemType[nextIndex] = charm.key;
        OakItemType[charm.key] = nextIndex;
        nextIndex++;
    });

    class OakCharm extends OakItem {
        constructor(charm) {
            super(OakItemType[charm.key], charm.displayName, charm.description, true, charm.bonusList, 1, 0, 1,
                charm.expList, 5, AmountFactory.createArray(charm.costList, GameConstants.Currency.money));
            this.charm = charm;
        }

        // The base class unlocks on unique pokémon caught; each charm has its own condition.
        isUnlocked() {
            return this.charm.isUnlocked();
        }

        getHint() {
            return this.charm.hint;
        }

        get hint() {
            return ko.pureComputed(() => this.getHint());
        }
    }

    // Add the items right after the game builds its own list, before Game.load()
    // reads the save and before Knockout renders the (non-observable) list.
    const initializeOld = OakItems.prototype.initialize;
    OakItems.prototype.initialize = function (...args) {
        const result = initializeOld.apply(this, args);
        oakCharms.forEach((charm) => {
            if (this.itemList[OakItemType[charm.key]] === undefined) {
                this.itemList[OakItemType[charm.key]] = new OakCharm(charm);
            }
        });
        return result;
    };

    // The game serializes every item of the list, charms included. Take them back out
    // so the save stays vanilla, and refresh the side store instead: toJSON runs at
    // every save tick, on download and for backups, which is exactly the cadence wanted.
    const toJSONOld = OakItems.prototype.toJSON;
    OakItems.prototype.toJSON = function (...args) {
        const save = toJSONOld.apply(this, args);
        const charms = {};
        oakCharms.forEach((charm) => {
            charms[charm.key] = save[charm.key];
            delete save[charm.key];
        });
        // Game.load() may call toJSON before fromJSON on a brand-new save; never let
        // the defaults overwrite a store that has not been read yet
        if (charmsLoaded) {
            storeCharmProgress(charms);
        }
        return save;
    };

    // The original still applies charm keys found in a save written by an older
    // version of this script, so an upgrade loses nothing; the side store then wins.
    const fromJSONOld = OakItems.prototype.fromJSON;
    OakItems.prototype.fromJSON = function (json, ...args) {
        const result = fromJSONOld.call(this, json, ...args);
        const stored = loadCharmProgress() ?? restoreCharmProgressFromClient();
        if (stored) {
            oakCharms.forEach((charm) => {
                const item = this.itemList[OakItemType[charm.key]];
                if (item && stored[charm.key]) {
                    item.fromJSON(stored[charm.key]);
                }
            });
            this.maxLevelOakItems(this.itemList.filter((item) => item.isMaxLevel()).length);
        }
        charmsLoaded = true;
        return result;
    };

    // Every currency gain goes through Wallet.addAmount -> calcBonus, which
    // returns 1 for these currencies in the base game. OakItem.use() only grants
    // exp while the item is equipped, so an unequipped charm stays at x1 and
    // gains nothing. addAmount skips calcBonus entirely when ignoreBonus is set,
    // so flat rewards stay flat.
    const calcBonusOld = Wallet.prototype.calcBonus;
    Wallet.prototype.calcBonus = function (amount, ...args) {
        const charm = oakCharms.find((c) => amount?.currency === GameConstants.Currency[c.currency]);
        if (charm && App.game?.oakItems) {
            const item = oakCharmItem(charm);
            const bonus = item.calculateBonus();
            const exp = charm.expOnGain(amount.amount, bonus);
            if (exp > 0) {
                item.use(exp);
            }
            return bonus;
        }
        return calcBonusOld.call(this, amount, ...args);
    };

    // The Battle Charm levels on Battle Frontier stages completed, one exp each.
    const nextStageOld = BattleFrontierRunner.nextStage;
    BattleFrontierRunner.nextStage = function (...args) {
        const result = nextStageOld.apply(this, args);
        if (App.game?.oakItems) {
            oakCharmItem(oakCharms.find((c) => c.key === 'Battle_Charm')).use();
        }
        return result;
    };

    // The Oak Item grids break their rows every 4 items, and a Bootstrap .col alone
    // on its row takes the full width, so a lone tile came out four times too big.
    // Pinning every tile to a quarter row changes nothing for the full rows.
    const style = document.createElement('style');
    style.textContent = '#oakItemsModal ul.row > li.col { flex: 0 0 25%; max-width: 25%; }';
    document.head.appendChild(style);

    // The Oak Item templates build the image path from the enum key. Image error
    // events do not bubble, so catch them in the capture phase and swap the icon.
    document.addEventListener('error', (event) => {
        const target = event.target;
        if (target?.tagName !== 'IMG') {
            return;
        }
        const charm = oakCharms.find((c) => target.src.endsWith(`oakitems/${c.key}.png`));
        if (charm) {
            target.src = charm.icon;
        }
    }, true);
}

function initOakCharms() {
    if (oakCharms.some((charm) => oakCharmItem(charm) === undefined)) {
        throw new Error('The Oak Charms were not added to the game; the script probably loaded after the game started.');
    }

    // Only the desktop client can write files; it polls this list from its main process
    if (App.isUsingClient) {
        window.DesktopSaveBackupProviders = window.DesktopSaveBackupProviders ?? [];
        window.DesktopSaveBackupProviders.push(collectOakCharmsBackup);
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

if (!App.isUsingClient || localStorage.getItem('oakcharms') === 'true') {
    loadEpheniaScript('oakcharms', initOakCharms, initOakCharmsOverrides);
}
