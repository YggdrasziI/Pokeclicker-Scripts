// Scenario for tools/realgame/start.mjs, with omegaproteingains and pokeclickerautomation:
// the Automation's Auto Vitamins reaches a target above the game's cap, since the script
// lifts the cap everything reads. Works on a fresh save or with --save.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const vitamins = Automation.Vitamins;
    const storage = Automation.Utils.LocalStorage;
    const protein = GameConstants.VitaminType.Protein;
    const gameCap = PartyPokemon.omegaProteinBaseMaxVitaminUsesAllowed();
    const target = gameCap + 20;

    check('cap lifted before the loop runs', PartyPokemon.maxVitaminUsesAllowed() === Infinity);

    if (!App.game.party.getPokemonByName('Bulbasaur')) {
        App.game.party.gainPokemonByName('Bulbasaur', false, true);
    }
    const mon = App.game.party.getPokemonByName('Bulbasaur');
    mon.vitaminsUsed[protein](0);

    // Only Bulbasaur gets the stock: the target is reached one pokémon at a time
    const stock = target;
    player.itemList.Protein(stock);
    storage.setValue(vitamins.Settings.Target('Protein'), target);
    storage.setValue(vitamins.Settings.Target('Calcium'), 0);
    storage.setValue(vitamins.Settings.Target('Carbos'), 0);
    const others = App.game.party.caughtPokemon.filter((p) => p !== mon);
    others.forEach((p) => p.vitaminsUsed[protein](target));

    vitamins.__internal__vitaminsLoop();
    check(`Bulbasaur holds ${target} Protein, past the game cap of ${gameCap}`, mon.vitaminsUsed[protein]() === target, mon.vitaminsUsed[protein]());
    check('the stock was spent', player.itemList.Protein() === 0, player.itemList.Protein());

    others.forEach((p) => p.vitaminsUsed[protein](0));
    storage.setValue(vitamins.Settings.Target('Protein'), 0);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
