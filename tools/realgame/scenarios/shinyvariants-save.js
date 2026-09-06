// Scenario for tools/realgame/start.mjs, with shinyvariants (and customachievements):
// unlock two palettes on Zubat, save through the game's own path, reload the game
// from that save and check the palettes survived and the achievement filter sees
// the custom achievements.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };

    ShinyVariants.rollVariant = () => 2;
    App.game.party.gainPokemonById(41, true);
    const zubat = App.game.party.getPokemon(41);
    check('epic unlocked and shown', ShinyVariants.unlockedMask(zubat) === 4 && ShinyVariants.shownVariant(41) === 2);
    check('sprite requested', ShinyVariants.builds.has('41:2'));
    ShinyVariants.rollVariant = () => 1;
    App.game.party.gainPokemonById(41, true);
    check('rare added, epic still shown', ShinyVariants.unlockedMask(zubat) === 6 && ShinyVariants.shownVariant(41) === 2);

    const saveObject = Save.getSaveObject();
    const entry = saveObject.party.caughtPokemon.find((c) => c.id === 41);
    check('saved keys', entry.sv === 6 && entry.svp === undefined, JSON.stringify(entry));
    localStorage.setItem(`save${Save.key}`, JSON.stringify(saveObject));
    localStorage.setItem(`player${Save.key}`, JSON.stringify(player));

    App.game = new Game();
    App.game.initialize();
    const reloaded = App.game.party.getPokemon(41);
    check('palettes after reload', !!reloaded?.shiny && ShinyVariants.unlockedMask(reloaded) === 6 && ShinyVariants.shownVariant(41) === 2);

    if (typeof CustomAchievements !== 'undefined') {
        AchievementHandler.filter.type(GameConstants.AchievementType['Shiny Pokemon']);
        AchievementHandler.filter.category('shinyVariants');
        AchievementHandler.filterAchievementList();
        check('shiny filter lists the custom achievements', AchievementHandler.achievementListFiltered().length > 0, AchievementHandler.achievementListFiltered().length);
    }

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
