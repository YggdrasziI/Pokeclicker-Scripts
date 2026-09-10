// Scenario for tools/realgame/start.mjs, with omegaproteingains: the game's vitamin cap is
// lifted for everything that reads it, Protein goes past the game's cap, and Carbos is still
// capped at 70 by the script. Works on a fresh save or with --save.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };

    check('installed once', PartyPokemon.omegaProteinInstalled === true);
    check('cap is infinite', PartyPokemon.maxVitaminUsesAllowed() === Infinity);
    check('original kept', PartyPokemon.omegaProteinBaseMaxVitaminUsesAllowed() === (player.highestRegion() + 1) * 5);
    check('shown as ∞', PartyPokemon.maxVitaminUsesAllowed().toLocaleString('en-US') === '∞');

    if (!App.game.party.getPokemonByName('Bulbasaur')) {
        App.game.party.gainPokemonByName('Bulbasaur', false, true);
    }
    const mon = App.game.party.getPokemonByName('Bulbasaur');
    const protein = GameConstants.VitaminType.Protein;
    const carbos = GameConstants.VitaminType.Carbos;
    check('remaining is infinite', mon.vitaminUsesRemaining() === Infinity && mon.vitaminUsesRemaining() != 0);

    const proteinBefore = mon.vitaminsUsed[protein]();
    player.itemList.Protein(100);
    mon.useVitamin(protein, 60);
    check('60 Protein accepted, past the game cap', mon.vitaminsUsed[protein]() === proteinBefore + 60 && player.itemList.Protein() === 40,
        `${mon.vitaminsUsed[protein]()} used, ${player.itemList.Protein()} left`);

    player.itemList.Carbos(100);
    mon.useVitamin(carbos, 100);
    check('Carbos still capped at 70', mon.vitaminsUsed[carbos]() === 70, mon.vitaminsUsed[carbos]());
    check('still counted as not maxed', mon.vitaminUsesRemaining() === Infinity);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
