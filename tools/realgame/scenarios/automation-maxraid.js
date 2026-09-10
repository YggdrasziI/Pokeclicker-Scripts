// Scenario for tools/realgame/start.mjs, with pokeclickerautomation (and optionally
// infinitemaxraid): the Max Raid panel is wired, off by default and hidden outside Galar;
// the loop leaves the game alone when no den is open; the round-robin cycles the open dens.
// On a fresh save nothing is open; with a Galar --save past the Lair of Giants questline
// the open dens are listed, one is started from its town, and the outcome is read back.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const raid = Automation.MaxRaid;

    check('module aliased', raid === AutomationMaxRaid);
    const button = document.getElementById('MaxRaid-RaidEnabled');
    check('Auto Raid rendered, off', button !== null && button.textContent === 'Off', button?.textContent);
    check('notification key and toggle', Automation.Notifications.Settings.MaxRaid === 'Notifications-MaxRaid'
        && document.getElementById('Notifications-MaxRaid') !== null);

    // Round-robin, independent of the game state
    const a = TemporaryBattleList['Max Raid Charizard'];
    const b = TemporaryBattleList['Max Raid Machamp'];
    raid.__internal__lastRaidName = null;
    check('starts with the first den', raid.__internal__pickNextDen([a, b]) === a);
    raid.__internal__lastRaidName = a.name;
    check('then the next', raid.__internal__pickNextDen([a, b]) === b);
    raid.__internal__lastRaidName = b.name;
    check('and wraps', raid.__internal__pickNextDen([a, b]) === a);
    check('a won den drops out without the Infinite script', raid.__internal__pickNextDen([b]) === b);
    check('nothing to pick from an empty list', raid.__internal__pickNextDen([]) === null);
    raid.__internal__lastRaidName = null;

    // Panel visibility follows the region and the questline
    raid.__internal__updateDivVisibilityAndContent();
    const densUnlocked = raid.__internal__areDensUnlocked();
    check('panel follows region and questline', raid.__internal__maxRaidPanel.hidden === !(player.region === GameConstants.Region.galar && densUnlocked),
        `region ${player.region}, dens unlocked ${densUnlocked}, hidden ${raid.__internal__maxRaidPanel.hidden}`);

    const openDens = raid.__internal__getOpenDens();
    if (!densUnlocked) {
        check('nothing open before the questline', openDens.length === 0, openDens.length);
        const state = App.game.gameState;
        raid.__internal__autoRaidLoopCallback();
        check('idle loop leaves the game alone', App.game.gameState === state);
        out.push('     (dens locked on this save, raid start skipped)');
    } else {
        check('open dens are Max Raids on the map', openDens.every((d) => d.optionalArgs.displayName === 'Max Raid' && d.isVisible()), openDens.map((d) => d.name).join(', '));
        if (openDens.length === 0) {
            out.push('     (no den open today on this save, raid start skipped)');
        } else {
            // Show the panel the way the watcher would once in Galar, then let the loop start a raid
            Automation.Utils.Route.moveToTown(openDens[0].optionalArgs.returnTown);
            raid.__internal__updateDivVisibilityAndContent();
            check('panel visible in Galar', raid.__internal__maxRaidPanel.hidden === false);
            raid.__internal__autoRaidLoopCallback();
            const started = raid.__internal__pendingRaidName;
            check('a raid was started', started !== null && App.game.gameState === GameConstants.GameState.temporaryBattle, started);
            check('from its own town', player.town.name === TemporaryBattleList[started]?.optionalArgs.returnTown && player.region === GameConstants.Region.galar,
                `${player.town.name}, region ${player.region}`);
            check('the raid is the Gigantamax boss', TemporaryBattleBattle.enemyPokemon()?.name.startsWith('Gigantamax'), TemporaryBattleBattle.enemyPokemon()?.name);
            check('loop waits while the raid runs', (raid.__internal__autoRaidLoopCallback(), raid.__internal__pendingRaidName === started));
            // Time the raid out: the game records a loss, the loop turns the feature off
            TemporaryBattleRunner.timeLeft(-1);
            TemporaryBattleRunner.tick();
            check('the game ended the raid on the timer', App.game.gameState === GameConstants.GameState.town && TemporaryBattleRunner.timeLeft() < 0);
            Automation.Utils.LocalStorage.setValue(raid.Settings.FeatureEnabled, true);
            raid.__internal__autoRaidLoopCallback();
            check('a loss turns the feature off', Automation.Utils.LocalStorage.getValue(raid.Settings.FeatureEnabled) === 'false' && raid.__internal__pendingRaidName === null);
        }
    }

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
