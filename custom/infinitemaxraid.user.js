// ==UserScript==
// @name          [Pokeclicker] Infinite Max Raid
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Keeps Galar's Max Raid dens open after a win, so a den drawn today can be raided for the whole day. Which ten dens the game draws each day is unchanged, and the save stays what the unmodified game would write.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/infinitemaxraid.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/infinitemaxraid.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// A den is "done for the day" through its completeRequirements: a TemporaryBattleRequirement
// asking for one win, on a statistic the game zeroes every day. Asking for infinitely many
// wins keeps the den open; the daily draw of dens (SeededDateSelectNRequirement, shared with
// other rotations) and the win statistic are left alone.
function isMaxRaidDen(battle) {
    return battle.optionalArgs?.resetDaily === true && battle.name.startsWith('Max Raid');
}

// Runs on document ready, before the game is built and the map bound, so the dens are open
// the first time the map draws them.
function initInfiniteMaxRaidOverrides() {
    if (TemporaryBattle.prototype.infiniteMaxRaidInstalled) {
        console.warn('Infinite Max Raid: already installed, skipping overrides');
        return;
    }
    const dens = Object.values(TemporaryBattleList).filter(isMaxRaidDen);
    if (dens.length === 0) {
        throw new Error('No Max Raid den found; the game version probably does not match the script.');
    }
    dens.forEach((den) => {
        den.completeRequirements = [new TemporaryBattleRequirement(den.name, Infinity)];
    });
    TemporaryBattle.prototype.infiniteMaxRaidInstalled = true;
}

function initInfiniteMaxRaid() {
    const dens = Object.values(TemporaryBattleList).filter(isMaxRaidDen);
    if (!dens.every((den) => den.completeRequirements[0]?.requiredValue === Infinity)) {
        throw new Error('The Max Raid dens were not kept open; the overrides did not run.');
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

if (!App.isUsingClient || localStorage.getItem('infinitemaxraid') === 'true') {
    loadEpheniaScript('infinitemaxraid', initInfiniteMaxRaid, initInfiniteMaxRaidOverrides);
}
