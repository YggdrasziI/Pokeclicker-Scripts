// Scenario for tools/realgame/start.mjs, with infinitemaxraid: every Max Raid den asks for
// infinitely many wins to be "done", so it stays visible after a win; the daily draw of
// dens and the other daily battles are untouched. Works on a fresh save or with --save.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const dens = Object.values(TemporaryBattleList).filter((b) => b.optionalArgs?.displayName === 'Max Raid');

    check('installed once', TemporaryBattle.prototype.infiniteMaxRaidInstalled === true);
    check('30 dens', dens.length === 30, dens.length);
    check('no den can be marked done', dens.every((b) => b.completeRequirements.length === 1
        && b.completeRequirements[0] instanceof TemporaryBattleRequirement
        && b.completeRequirements[0].battleName === b.name
        && b.completeRequirements[0].requiredValue === Infinity
        && !b.completeRequirements[0].isCompleted()));
    check('other daily battles untouched', TemporaryBattleList['Gyarados Crew'].completeRequirements[0].requiredValue === 1);
    check('daily draw untouched', dens.every((b) => b.requirements.some((r) => r instanceof SeededDateSelectNRequirement)));

    // A den that is unlocked and drawn today stays on the map after a win
    const den = TemporaryBattleList['Max Raid Venusaur'];
    const idx = GameConstants.getTemporaryBattlesIndex(den.name);
    const stat = App.game.statistics.temporaryBattleDefeated[idx];
    const savedRequirements = den.requirements;
    const savedStat = stat();
    den.requirements = [];
    check('visible before a win', den.isVisible());
    GameHelper.incrementObservable(stat);
    check('still visible after a win', den.isVisible() && stat() === savedStat + 1);
    check('progress stays a number', den.completeRequirements[0].getProgressPercentage() === '0.0', den.completeRequirements[0].getProgressPercentage());
    den.requirements = savedRequirements;
    stat(savedStat);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
