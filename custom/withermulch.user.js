// ==UserScript==
// @name          [Pokeclicker] Wither Mulch
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Adds a Wither Mulch to the farm, sold for Farm Points next to the game's own mulches: put on a plot, it makes the Berry plant wither at once, with everything the game does when a plant withers (half its harvest dropped, a chance to replant itself, a chance to turn into a Kasib Berry). One mulch per plant. A Kasib Berry that withers is what gives the Banettite, 5% of the time once you reached Kalos and caught Banette. The save stays exactly what the unmodified game would write.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/ephymew-only/custom/withermulch.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/ephymew-only/custom/withermulch.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// 'key' is the MulchType name the mulch is registered and bought under: never rename it
// once released. The game has no image for it: 'icon' is a game mulch drawn darker.
const witherMulch = {
    key: 'Wither_Mulch',
    displayName: 'Wither Mulch',
    description: 'Makes the Berry plant wither at once, as it does past its last stage. One mulch per plant.',
    price: 300,
    icon: 'assets/images/items/farm/Rich_Mulch.png',
};

// Set by the overrides: the mulch's MulchType value, and the length of the game's own
// mulchList (one entry per MulchType value, None included), the length a save keeps.
let witherMulchType = null;
let vanillaMulchListLength = null;

// The stock lives outside the game save, per save file, in the browser storage: a save
// loaded without this script must not meet a mulchList longer than the game's own.
let witherMulchLoaded = false;

function witherMulchStoreKey() {
    return `withermulch-${Save.key}`;
}

function loadWitherMulchStock() {
    try {
        return Number(JSON.parse(localStorage.getItem(witherMulchStoreKey()))?.stock) || 0;
    } catch {
        return 0;
    }
}

// Withers the plant of one plot for one mulch, the way the game applies a mulch: an
// unlocked plot, not safe-locked, and something planted on it. Returns whether it did.
function witherPlot(farming, index) {
    const plot = farming.plotList[index];
    if (!plot || !plot.isUnlocked || plot.isSafeLocked || plot.berry === BerryType.None) {
        return false;
    }
    if (farming.mulchList[witherMulchType]() <= 0) {
        return false;
    }
    GameHelper.incrementObservable(farming.mulchList[witherMulchType], -1);
    // The per-type count (statistics.mulchesUsed) would grow a save entry the game does not have
    GameHelper.incrementObservable(App.game.statistics.totalMulchesUsed);
    plot.die(false);
    return true;
}

// Runs on document ready, before the game builds its farm and applies its Knockout
// bindings: the farm's mulch lists are built from the MulchType enum and ItemList then.
function initWitherMulchOverrides() {
    if (MulchType[witherMulch.key] !== undefined) {
        console.warn('Wither Mulch: already registered, skipping overrides');
        return;
    }
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Wither Mulch script loaded; the mulch cannot be added this session.');
    }

    // Extend the MulchType enum in both directions, like a TypeScript enum: the farm
    // lists read the names, the mulch stock is indexed by the value.
    const values = Object.keys(MulchType).map(Number).filter((value) => !Number.isNaN(value));
    vanillaMulchListLength = values.length;
    witherMulchType = Math.max(...values) + 1;
    MulchType[witherMulchType] = witherMulch.key;
    MulchType[witherMulch.key] = witherMulchType;

    ItemList[witherMulch.key] = new MulchItem(witherMulchType, witherMulch.price, witherMulch.displayName, witherMulch.description);

    // Sold wherever the game sells mulch, right after its own. The Explorers Poké Mart
    // builds its own mulch items, shown only once the farm shortcut is: the copy there
    // takes the visibility of the Freeze Mulch next to it.
    const shops = new Set([pokeMartShop, ...Object.values(TownList).flatMap((town) => town.content ?? [])]);
    shops.forEach((shop) => {
        if (!(shop instanceof Shop) || !Array.isArray(shop.items)) {
            return;
        }
        const mulches = shop.items.filter((item) => item instanceof MulchItem);
        if (!mulches.length || mulches.some((item) => item.type === witherMulchType)) {
            return;
        }
        const template = mulches.find((item) => item.type === MulchType.Freeze_Mulch) ?? mulches[mulches.length - 1];
        const item = template === ItemList[template.name]
            ? ItemList[witherMulch.key]
            : new MulchItem(witherMulchType, witherMulch.price, witherMulch.displayName, witherMulch.description, { visible: template.visible });
        shop.items.splice(shop.items.indexOf(mulches[mulches.length - 1]) + 1, 0, item);
    });

    // Putting the mulch on a plot withers its plant instead of mulching it: the plot is
    // never left with this mulch on it. One mulch per plot, whatever amount is asked.
    const addMulchOld = Farming.prototype.addMulch;
    Farming.prototype.addMulch = function (index, mulch, ...args) {
        if (Number(mulch) === witherMulchType) {
            return witherPlot(this, index);
        }
        return addMulchOld.call(this, index, mulch, ...args);
    };

    // "Mulch All" withers every plant it can, one mulch each, as long as the stock lasts
    const mulchAllOld = Farming.prototype.mulchAll;
    Farming.prototype.mulchAll = function (mulch, ...args) {
        if (Number(mulch) === witherMulchType) {
            this.plotList.forEach((plot, index) => witherPlot(this, index));
            return;
        }
        return mulchAllOld.call(this, mulch, ...args);
    };

    // The save keeps the game's own mulchList, with the unused last slot at 0 as the
    // game writes it; the stock goes to the side store. toJSON runs at every save tick.
    const toJSONOld = Farming.prototype.toJSON;
    Farming.prototype.toJSON = function (...args) {
        const json = toJSONOld.apply(this, args);
        const stock = json.mulchList?.[witherMulchType] ?? 0;
        if (Array.isArray(json.mulchList)) {
            json.mulchList = json.mulchList.slice(0, vanillaMulchListLength);
            if (witherMulchType < vanillaMulchListLength) {
                json.mulchList[witherMulchType] = 0;
            }
        }
        // Game.load() may save before loading on a brand-new save; never let the
        // default overwrite a store that has not been read yet
        if (witherMulchLoaded) {
            localStorage.setItem(witherMulchStoreKey(), JSON.stringify({ stock }));
        }
        return json;
    };

    const fromJSONOld = Farming.prototype.fromJSON;
    Farming.prototype.fromJSON = function (...args) {
        const result = fromJSONOld.apply(this, args);
        this.mulchList[witherMulchType]?.(loadWitherMulchStock());
        witherMulchLoaded = true;
        return result;
    };

    // The farm lists build the image path from the enum name. Image error events do
    // not bubble, so catch them in the capture phase and swap in the borrowed icon.
    const style = document.createElement('style');
    style.textContent = '.withermulch-icon { filter: grayscale(1) brightness(0.55); }';
    document.head.appendChild(style);
    document.addEventListener('error', (event) => {
        const target = event.target;
        if (target?.tagName === 'IMG' && target.src.endsWith(`items/farm/${witherMulch.key}.png`)) {
            target.classList.add('withermulch-icon');
            target.src = witherMulch.icon;
        }
    }, true);
}

function initWitherMulch() {
    if (ItemList[witherMulch.key] === undefined || App.game.farming.mulchList[witherMulchType] === undefined) {
        throw new Error('The Wither Mulch was not added to the game; the script probably loaded after the game started.');
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

if (!App.isUsingClient || localStorage.getItem('withermulch') === 'true') {
    loadEpheniaScript('withermulch', initWitherMulch, initWitherMulchOverrides);
}
