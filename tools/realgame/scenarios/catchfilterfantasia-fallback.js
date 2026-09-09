// Scenario for tools/realgame/start.mjs, with catchfilterfantasia: when the script's
// Catch Filter is on but nothing is filtered (no Pokémon, no type), the "Empty filter
// → game filters" option lets the game's own Pokéball filters pick the ball instead of
// catching nothing. A filtered Pokémon or an enabled type switches the fallback off again.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const NONE = GameConstants.Pokeball.None;
    const pick = (id, shiny = false) => App.game.pokeballs.calculatePokeballToUse(id, shiny, false, EncounterType.route);
    const vanilla = (id, shiny = false) => App.game.pokeballs.oldCalculatePokeballToUse(id, shiny, false, EncounterType.route);

    // Setup: the game's own filters give a Pokéball to an uncaught Pokémon
    App.game.pokeballs.gainPokeballs(GameConstants.Pokeball.Pokeball, 50, false);
    const bulbasaur = 1;
    check('the game filters would use a Pokéball', vanilla(bulbasaur) === GameConstants.Pokeball.Pokeball, vanilla(bulbasaur));

    const fallbackBtn = document.getElementById('catch-filter-fallback');
    check('fallback button in the filter modal', !!fallbackBtn && fallbackBtn.textContent.endsWith('[OFF]'), fallbackBtn?.textContent);
    check('fallback off by default', filterFallback === false && localStorage.getItem('filterFallback') === 'false');

    // Filter on, nothing filtered, fallback off: nothing is caught (previous behaviour)
    filterState = true;
    catchFilter = [];
    filterTypes.fill(false);
    check('empty filter without fallback catches nothing', pick(bulbasaur) === NONE && pick(bulbasaur, true) === NONE);

    // Fallback on: the game filters decide
    fallbackBtn.click();
    check('button toggled on', filterFallback === true && localStorage.getItem('filterFallback') === 'true' && fallbackBtn.innerText.endsWith('[ON]'), fallbackBtn.innerText);
    check('button turned green', fallbackBtn.className === 'btn btn-success');
    check('empty filter with fallback uses the game filters', pick(bulbasaur) === vanilla(bulbasaur) && pick(bulbasaur, true) === vanilla(bulbasaur, true), pick(bulbasaur));

    // A filtered Pokémon makes the script's filter non-empty again
    catchFilter = [4];
    check('another filtered Pokémon: unfiltered one is not caught', pick(bulbasaur) === NONE);
    check('filtered Pokémon without ball preference uses the game filters', pick(4) === vanilla(4));
    filterBallPref[pokemonList.findIndex(p => p.id == 4)] = { normal: 2, shiny: 0 };
    App.game.pokeballs.gainPokeballs(GameConstants.Pokeball.Greatball, 5, false);
    check('filtered Pokémon with ball preference keeps it', pick(4) === GameConstants.Pokeball.Greatball);
    catchFilter = [];

    // An enabled type does too
    filterTypes[PokemonType.Fire] = true;
    check('a type on: Pokémon of another type is not caught', pick(bulbasaur) === NONE);
    check('a type on: Pokémon of that type uses the game filters', pick(4) === GameConstants.Pokeball.Greatball);
    filterTypes.fill(false);

    // Filter off: the game filters, whatever the option
    filterState = false;
    check('filter off leaves the game filters alone', pick(bulbasaur) === vanilla(bulbasaur));

    // Back off
    fallbackBtn.click();
    check('button toggled off', filterFallback === false && localStorage.getItem('filterFallback') === 'false' && fallbackBtn.className === 'btn btn-danger');
    filterState = true;
    check('empty filter without fallback catches nothing again', pick(bulbasaur) === NONE);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
