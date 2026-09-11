// Scenario for tools/realgame/start.mjs, with shinyvariants: four Pokémon holding
// different palettes (none, standard, rare, rare and epic), then each Rare / Epic
// status and its "Not" counterpart of the Pokédex "Caught Status" and the Hatchery
// "Shiny Status" filters lists exactly the expected ones, and the game's own
// statuses keep working. The Hatchery list is rate-limited, hence the timers.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const same = (list, expected) => JSON.stringify(list) === JSON.stringify(expected);

    ShinyVariants.rollVariant = () => 0;
    App.game.party.gainPokemonById(1, false); // Bulbasaur: no palette
    App.game.party.gainPokemonById(4, true);  // Charmander: standard
    ShinyVariants.rollVariant = () => 1;
    App.game.party.gainPokemonById(7, true);  // Squirtle: rare
    ShinyVariants.rollVariant = () => 2;
    App.game.party.gainPokemonById(25, true); // Pikachu: epic...
    ShinyVariants.rollVariant = () => 1;
    App.game.party.gainPokemonById(25, true); // ...and rare
    const masks = [1, 4, 7, 25].map((id) => ShinyVariants.unlockedMask(App.game.party.getPokemon(id)));
    check('palettes set up: none, standard, rare, rare+epic', same(masks, [0, 1, 2, 6]), JSON.stringify(masks));

    // Pokédex
    const dexFilter = Settings.getSetting('pokedexCaughtFilter');
    const dexIds = (status) => {
        dexFilter.observableValue(status);
        return PokedexHelper.getList().map((pokemon) => pokemon.id).sort((a, b) => a - b);
    };
    check('Pokédex options added', ['caught-not-shiny-rare', 'caught-shiny-rare', 'caught-not-shiny-epic', 'caught-shiny-epic'].every((value) => dexFilter.options.some((option) => option.value === value)));
    check('Pokédex Caught Not Rare Shiny', same(dexIds('caught-not-shiny-rare'), [1, 4]), JSON.stringify(dexIds('caught-not-shiny-rare')));
    check('Pokédex Caught Rare Shiny', same(dexIds('caught-shiny-rare'), [7, 25]), JSON.stringify(dexIds('caught-shiny-rare')));
    check('Pokédex Caught Not Epic Shiny', same(dexIds('caught-not-shiny-epic'), [1, 4, 7]), JSON.stringify(dexIds('caught-not-shiny-epic')));
    check('Pokédex Caught Epic Shiny', same(dexIds('caught-shiny-epic'), [25]), JSON.stringify(dexIds('caught-shiny-epic')));
    check('Pokédex Caught Not Shiny still the game\'s', same(dexIds('caught-not-shiny'), [1]), JSON.stringify(dexIds('caught-not-shiny')));
    check('Pokédex Caught Shiny still the game\'s', same(dexIds('caught-shiny'), [4, 7, 25]), JSON.stringify(dexIds('caught-shiny')));
    dexFilter.observableValue('all');

    // Hatchery
    const hatcheryFilter = Settings.getSetting('breedingShinyFilter');
    check('Hatchery options added', [2, 3, 4, 5].every((value) => hatcheryFilter.options.some((option) => option.value === value)));
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const hatcheryIds = async (raw) => {
        hatcheryFilter.rawObservableValue(raw);
        await wait(30);
        return BreedingController.hatcheryFilteredList().map((pokemon) => pokemon.id).sort((a, b) => a - b);
    };
    const expectations = [
        // raw value, what the game reads, expected list
        [4, -1, [1, 4], 'Not Rare Shiny'],
        [2, 1, [7, 25], 'Rare Shiny'],
        [5, -1, [1, 4, 7], 'Not Epic Shiny'],
        [3, 1, [25], 'Epic Shiny'],
        [0, 0, [1], 'Not Shiny, the game\'s'],
        [1, 1, [4, 7, 25], 'Shiny, the game\'s'],
        [-1, -1, [1, 4, 7, 25], 'All'],
    ];
    (async () => {
        for (const [raw, gameStatus, expected, label] of expectations) {
            const ids = await hatcheryIds(raw);
            check(`Hatchery ${label}`, hatcheryFilter.observableValue() === gameStatus && same(ids, expected), `game reads ${hatcheryFilter.observableValue()}, ${JSON.stringify(ids)}`);
        }
        console.log(out.join('\n'));
        window.__scenario = !window.__scenarioFailed;
    })().catch((error) => {
        console.log(`SCENARIO FAILED: ${error.stack || error}`);
        window.__scenario = false;
    });
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
