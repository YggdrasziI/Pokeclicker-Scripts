// ==UserScript==
// @name          [Pokeclicker] Enhanced Auto Mine
// @namespace     Pokeclicker Scripts
// @author        Ephenia (Credit: falcon71, KarmaAlex, umbralOptimatum, Pastaficionado)
// @description   Automatically mines the Underground, digging out treasures and searching for a new mine when a layer is cleared. Features adjustable settings as well.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       3.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/enhancedautomine.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/enhancedautomine.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

var mineState;
var autoMineTimer;
var sellTreasureState;
var mineTypeSelection;
var useBombsState;
var layersMined;

// The game caps manual mining at 20 clicks per second
const MAX_ACTIONS_PER_TICK = 20;

function initAutoMine() {
    // The mines the game lets you search for, in the order its own "Find mine" dialog lists them
    const mineTypes = [MineType.Random, MineType.Diamond, MineType.GemPlate, MineType.Shard, MineType.Fossil, MineType.EvolutionItem];
    // Older versions of this script stored a treasure category here instead of a mine type
    if (!mineTypes.includes(mineTypeSelection)) {
        mineTypeSelection = MineType.Random;
        localStorage.setItem('autoMineType', mineTypeSelection);
    }
    const mineOptions = mineTypes
        .map((type) => `<option value="${type}"${type == mineTypeSelection ? ' selected' : ''}>${MineConfigs.find(type).displayName}</option>`)
        .join('');

    const minerHTML = document.createElement('div');
    minerHTML.setAttribute('class', 'row p-2 m-0');
    minerHTML.innerHTML = `<button id="auto-mine-start" class="col-12 col-md-4 btn btn-${mineState ? 'success' : 'danger'}">Auto Mine [${mineState ? 'ON' : 'OFF'}]</button>
<select id="auto-mine-type" title="Which mine to search for once a layer is cleared." class="col-12 col-md-4 btn">${mineOptions}</select>
<button id="auto-mine-bombs" class="col-12 col-md-4 btn btn-${useBombsState ? 'success' : 'danger'}" title="Bombs uncover rock much faster, but destroy most of the treasures they dig up.">Use Bombs [${useBombsState ? 'ON' : 'OFF'}]</button>`;
    document.getElementById('dig').prepend(minerHTML);

    const autoSeller = document.createElement('div');
    autoSeller.innerHTML = `<div>
    <button id="auto-sell-treasure" class="col-12 col-md-3 btn btn-${sellTreasureState ? 'success' : 'danger'}">Auto Sell Treasure [${sellTreasureState ? 'ON' : 'OFF'}]</button>
</div>`;
    document.getElementById('treasures').prepend(autoSeller);

    document.getElementById('auto-mine-start').addEventListener('click', event => { startAutoMine(event); });
    document.getElementById('auto-mine-bombs').addEventListener('click', event => { toggleBombs(event); });
    document.getElementById('auto-sell-treasure').addEventListener('click', event => { autoSellTreasure(event); });
    document.getElementById('auto-mine-type').addEventListener('input', event => { selectMineType(event); });

    // Start from the current count so a fresh load doesn't immediately sell
    layersMined = App.game.statistics.undergroundLayersMined();

    if (mineState) {
        // Wait a few seconds to not mine before underground is fully loaded
        setTimeout(() => {
            autoMineTimer = setInterval(function () {
                doAutoMine();
            }, 1000);
        }, 5000);
    }
}

function startAutoMine(event) {
    const element = event.target;
    mineState = !mineState
    mineState ? element.classList.replace('btn-danger', 'btn-success') : element.classList.replace('btn-success', 'btn-danger');
    element.textContent = `Auto Mine [${mineState ? 'ON' : 'OFF'}]`;
    if (mineState) {
        autoMineTimer = setInterval(function () {
            doAutoMine();
        }, 1000); // Happens every 1 second
    } else {
        clearInterval(autoMineTimer)
    }
    localStorage.setItem('autoMineState', mineState);
}

function doAutoMine() {
    const underground = App.game.underground;
    const mine = underground?.mine;
    if (!mine) {
        return;
    }

    // Selling doesn't depend on the state of the current layer, so handle it first
    if (sellTreasureState && App.game.statistics.undergroundLayersMined() != layersMined) {
        sellTreasures();
        layersMined = App.game.statistics.undergroundLayersMined();
    }

    // The mine still has to be discovered before anything can be dug up
    if (mine.timeUntilDiscovery > 0) {
        return;
    }

    if (mine.completed || mine.itemsFound >= mine.itemsBuried) {
        // The game already searches for a new mine itself when its own setting is on
        if (!Settings.getSetting('autoRestartUndergroundMine').observableValue()) {
            underground.generateMine(mineTypeSelection);
        }
        return;
    }

    // Survey marks a box that's guaranteed to hold a treasure we haven't uncovered yet,
    // so it's worth using the moment it comes off cooldown
    if (Mine.hiddenItemsIDSet(mine).size > 0 && underground.tools.getTool(UndergroundToolType.Survey)?.canUseTool()) {
        underground.tools.useTool(UndergroundToolType.Survey, 0, 0);
    }

    for (let action = 0; action < MAX_ACTIONS_PER_TICK; action++) {
        if (mine.completed || mine.itemsFound >= mine.itemsBuried) {
            break;
        }
        const next = nextMineAction(mine);
        if (!next || !underground.tools.getTool(next.tool)?.canUseTool()) {
            break;
        }
        underground.tools.useTool(next.tool, next.x, next.y);
    }
}

// Picks the next tile to dig and the tool to dig it with, or nothing if the layer is exhausted
function nextMineAction(mine) {
    const unmined = mine.grid
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile }) => tile.layerDepth > 0);
    if (!unmined.length) {
        return null;
    }

    // Treasures with a tile already showing are worth finishing off with the chisel,
    // which digs deep on a single tile and never destroys what it uncovers
    const partiallyFound = Mine.partiallyFoundItemsIDSet(mine);
    const exposed = unmined.filter(({ tile }) => tile.reward && !tile.reward.rewarded && partiallyFound.has(tile.reward.rewardID));
    if (exposed.length) {
        return { tool: UndergroundToolType.Chisel, ...mine.getCoordinateForGridIndex(exposed[0].index) };
    }

    // Nothing showing, so open up new ground instead
    if (useBombsState) {
        // The bomb picks its own tiles at random
        return { tool: UndergroundToolType.Bomb, x: 0, y: 0 };
    }
    const surveyed = tilesUnderSurvey(mine, unmined);
    const candidates = surveyed.length ? surveyed : unmined;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    return { tool: UndergroundToolType.Hammer, ...mine.getCoordinateForGridIndex(choice.index) };
}

// Survey marks a single tile with the size of the box it revealed around it
function tilesUnderSurvey(mine, unmined) {
    const boxes = mine.grid
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile }) => tile.survey > 0)
        .map(({ tile, index }) => ({ reach: Math.floor(tile.survey / 2), ...mine.getCoordinateForGridIndex(index) }));
    if (!boxes.length) {
        return [];
    }
    return unmined.filter(({ index }) => {
        const { x, y } = mine.getCoordinateForGridIndex(index);
        return boxes.some((box) => Math.abs(x - box.x) <= box.reach && Math.abs(y - box.y) <= box.reach);
    });
}

// Only diamonds and gem plates can be sold, so fossils and evolution items are never at risk
function sellTreasures() {
    UndergroundItems.getUnlockedItems()
        .filter((item) => item.hasSellValue() && !item.sellLocked())
        .forEach((item) => UndergroundController.sellMineItem(item, player.itemList[item.itemName]()));
}

function toggleBombs(event) {
    const element = event.target;
    useBombsState = !useBombsState;
    useBombsState ? element.classList.replace('btn-danger', 'btn-success') : element.classList.replace('btn-success', 'btn-danger');
    element.textContent = `Use Bombs [${useBombsState ? 'ON' : 'OFF'}]`;
    localStorage.setItem('autoMineBombs', useBombsState);
}

function autoSellTreasure(event) {
    const element = event.target;
    sellTreasureState = !sellTreasureState;
    sellTreasureState ? element.classList.replace('btn-danger', 'btn-success') : element.classList.replace('btn-success', 'btn-danger');
    element.textContent = `Auto Sell Treasure [${sellTreasureState ? 'ON' : 'OFF'}]`;
    localStorage.setItem('autoSellTreasure', sellTreasureState);
}

function selectMineType(event) {
    mineTypeSelection = +event.target.value;
    localStorage.setItem('autoMineType', mineTypeSelection);
}

if (!validParse(localStorage.getItem('autoMineState'))) {
    localStorage.setItem("autoMineState", false);
}
if (!validParse(localStorage.getItem('autoSellTreasure'))) {
    localStorage.setItem("autoSellTreasure", false);
}
if (!validParse(localStorage.getItem('autoMineType'))) {
    localStorage.setItem("autoMineType", 0);
}
if (!validParse(localStorage.getItem('autoMineBombs'))) {
    localStorage.setItem("autoMineBombs", false);
}
mineState = JSON.parse(localStorage.getItem('autoMineState'));
sellTreasureState = JSON.parse(localStorage.getItem('autoSellTreasure'));
mineTypeSelection = JSON.parse(localStorage.getItem('autoMineType'));
useBombsState = JSON.parse(localStorage.getItem('autoMineBombs'));

function validParse(key) {
    try {
        if (key === null) {
            throw new Error;
        }
        JSON.parse(key);
        return true;
    } catch (e) {
        return false;
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

if (!App.isUsingClient || localStorage.getItem('enhancedautomine') === 'true') {
    loadEpheniaScript('enhancedautomine', initAutoMine);
}
