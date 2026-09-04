// ==UserScript==
// @name          [Pokeclicker] Auto NPC Codes
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Automatically enters the redeemable codes that NPCs give you in their dialogue, so you don't have to copy them into the Enter Code box by hand. A code is only entered once you have actually opened that NPC's dialogue, and never twice.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/autonpccodes.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/autonpccodes.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// The codes an NPC has shown us, so nothing is ever redeemed without having been told about it
// first. The game does not track this itself: the NPCs that hand out codes have no saveKey, so
// NPC.hasTalkedTo() is always false for them.
// The code text is stored rather than its hash, so a code redeemed later can still be named in
// the notification. There is nothing to protect: it is the text the NPC displays on screen.
var npcCodesRevealed = [];

// Codes attempted during this page session, to avoid re-running one whose reward was declined
var npcCodesTriedThisSession = new Set();

function initAutoNpcCodes() {
    npcCodesRevealed = loadRevealedCodes();

    overrideOpenDialog();

    // Catch up on codes revealed earlier whose requirement has since been met, such as the Eon
    // Ticket handed over before reaching Hoenn. Nothing that was never revealed is considered.
    redeemRevealedCodes();
}

// Everything that opens an NPC dialogue goes through this one function
function overrideOpenDialog() {
    const oldOpenDialog = NPCController.openDialog;
    NPCController.openDialog = function (npc, ...args) {
        const result = oldOpenDialog.apply(this, [npc, ...args]);
        try {
            revealCodesFrom(npc);
        } catch (e) {
            // Never let this break the dialogue itself
            console.error('Auto NPC Codes: failed to read codes from an NPC dialogue', e);
        }
        return result;
    }
}

// Records every code this NPC shows, then tries to redeem them
function revealCodesFrom(npc) {
    const codes = extractCodesFromDialog(npc?.dialog);
    if (!codes.length) {
        return;
    }

    let revealedSomething = false;
    for (const code of codes) {
        // Only a real code counts; anything else in a <code> tag is just flavour text
        if (!findRedeemableCode(GameHelper.hash(code))) {
            continue;
        }
        if (!npcCodesRevealed.includes(code)) {
            npcCodesRevealed.push(code);
            revealedSomething = true;
        }
        tryRedeem(code, npc.name);
    }

    if (revealedSomething) {
        saveRevealedCodes();
    }
}

// The game wraps codes in a <code> tag, which makes them exact to find. Parsing through the DOM
// rather than a regex decodes any HTML entity the same way the dialogue itself would display it.
function extractCodesFromDialog(dialog) {
    if (!Array.isArray(dialog)) {
        return [];
    }
    const holder = document.createElement('div');
    const codes = [];
    for (const line of dialog) {
        if (typeof line !== 'string' || !line.includes('<code')) {
            continue;
        }
        holder.innerHTML = line;
        for (const elem of holder.querySelectorAll('code')) {
            const text = elem.textContent.trim();
            if (text) {
                codes.push(text);
            }
        }
    }
    return codes;
}

function findRedeemableCode(hash) {
    return App.game.redeemableCodes.codeList.find((code) => code.hash === hash);
}

// Redeems a revealed code, if it can be redeemed right now
async function tryRedeem(codeText, npcName = null) {
    const code = findRedeemableCode(GameHelper.hash(codeText));
    if (!code || code.isRedeemed) {
        return;
    }

    // The game would show a red "Cannot redeem this code yet" for these. Skipping quietly leaves
    // the code in the register, so it goes through on its own once the requirement is met.
    // requirement is private in the game's TypeScript, which does not exist at runtime.
    if (code.requirement && !code.requirement.isCompleted()) {
        return;
    }

    if (npcCodesTriedThisSession.has(codeText)) {
        return;
    }
    npcCodesTriedThisSession.add(codeText);

    // Some rewards ask for confirmation and only count once accepted, so check afterwards
    // rather than assuming redeem() succeeded
    await code.redeem();
    if (!code.isRedeemed) {
        return;
    }

    Notifier.notify({
        title: 'Auto NPC Codes',
        message: npcName ? `Entered ${codeText}, given by ${npcName}` : `Entered ${codeText}`,
        type: NotificationConstants.NotificationOption.success,
        timeout: 30 * GameConstants.SECOND,
    });
}

function redeemRevealedCodes() {
    for (const codeText of npcCodesRevealed) {
        tryRedeem(codeText);
    }
}

// Namespaced per save: a code revealed on one save must not be handed to another one, which
// would be exactly the "free without playing" this is meant to avoid
function revealedCodesKey() {
    return `autoNpcCodesRevealed-${Save.key}`;
}

function loadRevealedCodes() {
    try {
        const stored = JSON.parse(localStorage.getItem(revealedCodesKey()));
        return Array.isArray(stored) ? stored.filter((code) => typeof code === 'string') : [];
    } catch {
        return [];
    }
}

function saveRevealedCodes() {
    localStorage.setItem(revealedCodesKey(), JSON.stringify(npcCodesRevealed));
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

if (!App.isUsingClient || localStorage.getItem('autonpccodes') === 'true') {
    loadEpheniaScript('autonpccodes', initAutoNpcCodes);
}
