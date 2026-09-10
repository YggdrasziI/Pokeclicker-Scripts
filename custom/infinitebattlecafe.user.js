// ==UserScript==
// @name          [Pokeclicker] Infinite Battle Café
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Removes the Battle Café daily spin limit: the spin count never goes down, so you can spin for Alcremie forms for as long as you have the berries. The save keeps the game's own spin count.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/infinitebattlecafe.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/infinitebattlecafe.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// Runs once the save is loaded: BattleCafeSaveObject.fromJSON has restored the accumulated
// spin count by then, and that count is what the script keeps from now on.
function initInfiniteBattleCafe() {
    if (BattleCafeController.infiniteSpinsInstalled) {
        console.warn('Infinite Battle Café: already installed, skipping');
        return;
    }
    BattleCafeController.infiniteSpinsInstalled = true;

    // The game takes one spin off the count when a spin ends (BattleCafeController.spin) and
    // adds spinsPerDay() once a day (accumulateSpins). Keep the additions, undo the removals:
    // the count never drops, the save keeps a value the unmodified game would write, and
    // whatever reads spinsLeft() (the café window, the Automation's Auto Spin) sees spins left.
    // A count already at 0 is raised to 1, or nothing could ever start the first spin.
    let lastKnown = Math.max(1, BattleCafeController.spinsLeft());
    BattleCafeController.spinsLeft(lastKnown);
    BattleCafeController.spinsLeft.subscribe((value) => {
        if (value < lastKnown) {
            BattleCafeController.spinsLeft(lastKnown);
        } else {
            lastKnown = value;
        }
    });

    // The game defers observable notifications (ko.options.deferUpdates), so the count can read
    // 0 for a moment between the game's decrement and the restore above. The game's own check
    // refuses to spin at 0: hand it a spin before it looks, then let it run its other checks.
    const canSpinOld = BattleCafeController.canSpin;
    BattleCafeController.canSpin = function (...args) {
        if (BattleCafeController.spinsLeft() < 1) {
            BattleCafeController.spinsLeft(1);
        }
        return canSpinOld.apply(this, args);
    };
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

if (!App.isUsingClient || localStorage.getItem('infinitebattlecafe') === 'true') {
    loadEpheniaScript('infinitebattlecafe', initInfiniteBattleCafe);
}
