// Scenario for tools/realgame/start.mjs, with catchfilterfantasia: the "Unfiltered
// Pokémon → game filters" option hands the Pokémon the script's filter does not cover
// (not listed, no type on) to the game's own Pokéball filters instead of ignoring them,
// while the filtered Pokémon keep the balls chosen for them.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const NONE = GameConstants.Pokeball.None;
    const MASTER = GameConstants.Pokeball.Masterball;
    const pick = (id, shiny = false) => App.game.pokeballs.calculatePokeballToUse(id, shiny, false, EncounterType.route);
    const vanilla = (id, shiny = false) => App.game.pokeballs.oldCalculatePokeballToUse(id, shiny, false, EncounterType.route);
    const indexOf = (id) => pokemonList.findIndex(p => p.id == id);
    const bulbasaur = 1;
    const charmander = 4;
    const hoopa = 720;

    // Setup: the game's own filters give a Pokéball to an uncaught Pokémon
    App.game.pokeballs.gainPokeballs(GameConstants.Pokeball.Pokeball, 50, false);
    App.game.pokeballs.gainPokeballs(MASTER, 5, false);
    check('the game filters would use a Pokéball', vanilla(bulbasaur) === GameConstants.Pokeball.Pokeball && vanilla(hoopa) === GameConstants.Pokeball.Pokeball, vanilla(bulbasaur));

    const fallbackBtn = document.getElementById('catch-filter-fallback');
    check('fallback button in the filter modal', !!fallbackBtn && fallbackBtn.textContent.endsWith('[OFF]'), fallbackBtn?.textContent);
    check('fallback off by default', filterFallback === false && localStorage.getItem('filterFallback') === 'false');

    // Hoopa alone in the filter, Master Ball for both forms, fallback off: everything else is ignored
    filterState = true;
    filterTypes.fill(false);
    catchFilter = [hoopa];
    filterBallPref[indexOf(hoopa)] = { normal: MASTER + 1, shiny: MASTER + 1 };
    check('Hoopa gets the Master Ball', pick(hoopa) === MASTER && pick(hoopa, true) === MASTER, pick(hoopa));
    check('without fallback, an unfiltered Pokémon is not caught', pick(bulbasaur) === NONE && pick(bulbasaur, true) === NONE);

    // Fallback on: the unfiltered Pokémon follow the game filters, Hoopa keeps its ball
    fallbackBtn.click();
    check('button toggled on', filterFallback === true && localStorage.getItem('filterFallback') === 'true' && fallbackBtn.innerText.endsWith('[ON]'), fallbackBtn.innerText);
    check('button turned green', fallbackBtn.className === 'btn btn-success');
    check('Hoopa still gets the Master Ball', pick(hoopa) === MASTER && pick(hoopa, true) === MASTER);
    check('with fallback, an unfiltered Pokémon follows the game filters', pick(bulbasaur) === vanilla(bulbasaur) && pick(bulbasaur, true) === vanilla(bulbasaur, true), pick(bulbasaur));

    // A type on: Pokémon of that type are the script's, without a ball choice they follow the game filters
    filterTypes[PokemonType.Fire] = true;
    check('a Fire Pokémon without ball choice follows the game filters', pick(charmander) === vanilla(charmander));
    filterBallPref[indexOf(charmander)] = { normal: GameConstants.Pokeball.Greatball + 1, shiny: 0 };
    App.game.pokeballs.gainPokeballs(GameConstants.Pokeball.Greatball, 5, false);
    check('a Fire Pokémon with a ball choice keeps it', pick(charmander) === GameConstants.Pokeball.Greatball);
    check('a Pokémon of another type follows the game filters', pick(bulbasaur) === vanilla(bulbasaur));
    fallbackBtn.click();
    check('button toggled off', filterFallback === false && localStorage.getItem('filterFallback') === 'false' && fallbackBtn.className === 'btn btn-danger');
    check('without fallback, a Pokémon of another type is not caught', pick(bulbasaur) === NONE);
    check('the Fire Pokémon keeps its ball either way', pick(charmander) === GameConstants.Pokeball.Greatball);
    filterTypes.fill(false);
    fallbackBtn.click();

    // An empty filter with the fallback: everything follows the game filters
    catchFilter = [];
    check('empty filter with fallback follows the game filters', pick(bulbasaur) === vanilla(bulbasaur) && pick(hoopa) === vanilla(hoopa));
    fallbackBtn.click();
    check('empty filter without fallback catches nothing', pick(bulbasaur) === NONE && pick(hoopa) === NONE);

    // Filter off: the game filters, whatever the option
    filterState = false;
    check('filter off leaves the game filters alone', pick(bulbasaur) === vanilla(bulbasaur) && pick(hoopa) === vanilla(hoopa));
    fallbackBtn.click();
    check('filter off with fallback leaves the game filters alone', filterFallback === true && pick(hoopa) === vanilla(hoopa));

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
