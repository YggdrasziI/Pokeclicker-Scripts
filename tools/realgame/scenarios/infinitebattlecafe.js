// Scenario for tools/realgame/start.mjs, with infinitebattlecafe: the Battle Café spin count
// never goes down, daily accumulation still adds, the game's own spin check passes, and the
// save keeps the game's own count. Works on a fresh save or with --save.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    // The game defers observable notifications; the script's restore runs in that queue
    const flush = () => ko.tasks.runEarly();
    const C = BattleCafeController;

    check('installed once', C.infiniteSpinsInstalled === true);
    check('count floored at 1', C.spinsLeft() >= 1, C.spinsLeft());

    const before = C.spinsLeft();
    C.spinsLeft(before - 1);
    flush();
    check('a decrease is undone', C.spinsLeft() === before, `${before} -> ${C.spinsLeft()}`);

    C.accumulateSpins();
    flush();
    const expected = Math.min(before + C.spinsPerDay(), C.maxTotalSpins());
    check('daily accumulation still adds', C.spinsLeft() === expected, `${C.spinsLeft()} / ${expected}`);

    C.spinsLeft(0);
    flush();
    check('the new floor is the accumulated count', C.spinsLeft() === expected, C.spinsLeft());

    // The game's own check passes once it has a sweet, a duration and the berries
    C.selectedSweet(GameConstants.AlcremieSweet['Strawberry Sweet']);
    document.getElementById('battleCafeDuration').value = 3;
    C.getPrice(GameConstants.AlcremieSweet['Strawberry Sweet']).forEach((b) => App.game.farming.berryInventory[b.berry](b.amount + 100));
    check('canSpin passes with spins available', C.canSpin() === true);
    C.spinsLeft(0);
    check('canSpin hands the game a spin when the count reads 0', C.canSpin() === true && C.spinsLeft() >= 1);
    flush();
    check('and the restore brings the count back', C.spinsLeft() === expected, C.spinsLeft());

    const json = new BattleCafeSaveObject().toJSON();
    check('save is vanilla-shaped', Object.keys(json).join() === 'spinsLeft' && json.spinsLeft === expected, JSON.stringify(json));

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
