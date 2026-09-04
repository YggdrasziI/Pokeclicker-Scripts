// ==UserScript==
// @name          [Pokeclicker] Simple Time Changer
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI (Credit: KarmaAlex, Ephenia, Optimatum)
// @description   Adds a button to force the in-game hour, next to the weather selector, or to follow your computer clock. Useful for the day and night mechanics, such as the Battle Café spins and time-locked evolutions.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/simpletimechanger.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/simpletimechanger.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// -1 means "follow the computer clock", 0 to 23 forces that hour
var timeChangerHour;

function initTimeChange() {
    // Load the selected hour
    timeChangerHour = parseInt(localStorage.getItem('timeChangerHour'));
    if (isNaN(timeChangerHour) || timeChangerHour < 0 || timeChangerHour > 23) {
        timeChangerHour = -1;
    }

    // Make selectbox
    const hourOptions = Array.from({ length: 24 }, (_, hour) => {
        const label = `${hour.toString().padStart(2, '0')}:00`;
        return `<option value="${hour}">${label}</option>`;
    }).join('\n');
    const timeSelect = document.createElement('select');
    timeSelect.innerHTML = '<option value="-1">PC Time</option>\n' + hourOptions;
    timeSelect.id = 'change-time-select';
    timeSelect.value = timeChangerHour;

    // Sit next to the weather selector when it is installed, and take its place otherwise.
    // Both anchor on the day cycle button, which is the game's own clock indicator.
    const weatherSelect = document.getElementById('change-weather-select');
    const dayCycleButton = document.querySelector('#townMap button[data-bind*="DayCycle.color"]');
    (weatherSelect ?? dayCycleButton).before(timeSelect);

    timeSelect.addEventListener('change', (event) => { changeTime(event); });
    addGlobalStyle('#change-time-select { position: absolute; right: 190px; top: 10px; width: auto; height: 20px; font-size: 9px; }');

    overrideCurrentTime();
    applyForcedTime();
}

function changeTime(event) {
    timeChangerHour = +event.target.value;
    localStorage.setItem('timeChangerHour', timeChangerHour);
    applyForcedTime();
}

// Everything time-of-day in the game reads GameHelper.currentTime: the day cycle indicator, the
// Battle Café spin outcome, time-locked evolutions. GameHelper.tick is what keeps it up to date,
// so overriding that one point covers all of them at once.
function overrideCurrentTime() {
    const oldTick = GameHelper.tick;
    GameHelper.tick = function (...args) {
        const result = oldTick.apply(this, args);
        applyForcedTime();
        return result;
    };
}

function applyForcedTime() {
    if (timeChangerHour < 0) {
        // Back to the computer clock. The next tick would do it anyway, this just makes it immediate
        GameHelper.currentTime(new Date());
        return;
    }

    const forced = new Date(GameHelper.currentTime());
    if (forced.getHours() !== timeChangerHour) {
        // Only the hour is forced, so minutes and seconds keep running normally
        forced.setHours(timeChangerHour);
        GameHelper.currentTime(forced);
    }
}

function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
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

if (!App.isUsingClient || localStorage.getItem('simpletimechanger') === 'true') {
    loadEpheniaScript('simpletimechanger', initTimeChange);
}
