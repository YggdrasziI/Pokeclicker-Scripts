// Scenario for tools/realgame/start.mjs, with shinyvariants: four Pokémon holding
// different palettes (none, standard, rare, rare and epic), then the star elements
// the script put into the game's templates (Hatchery cards, Hatchery egg pools,
// Pokédex tiles, party list) draw one small star per unlocked palette, and the
// game's ✨ shows only when the stars are turned off. The tool does not apply the
// game's Knockout bindings, so each template fragment is cloned and bound here
// with the data the game would give it.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const expected = { 1: 0, 4: 1, 7: 1, 25: 2 };

    ShinyVariants.rollVariant = () => 0;
    App.game.party.gainPokemonById(1, false); // Bulbasaur: no palette
    App.game.party.gainPokemonById(4, true);  // Charmander: standard
    ShinyVariants.rollVariant = () => 1;
    App.game.party.gainPokemonById(7, true);  // Squirtle: rare
    ShinyVariants.rollVariant = () => 2;
    App.game.party.gainPokemonById(25, true); // Pikachu: epic...
    ShinyVariants.rollVariant = () => 1;
    App.game.party.gainPokemonById(25, true); // ...and rare

    // The game's ✨ and the script's stars, side by side in each template
    const fragments = {
        'Hatchery card': {
            sparkle: '#breeding-pokemon-list-container li.pokedexEntry div.breedingListShiny',
            data: (id) => App.game.party.getPokemon(id),
        },
        'Hatchery egg pool': {
            sparkle: '#breedingModal tbody tr td sup[data-bind*="partyPokemon?.shiny"]',
            data: (id) => ({ partyPokemon: App.game.party.getPokemon(id) }),
        },
        'Pokédex tile': {
            sparkle: '#pokedexModal li.pokedexEntry div[data-bind*="alreadyCaughtPokemonByName(name)"]',
            data: (id) => pokemonList.find((pokemon) => pokemon.id === id),
            sparkleAlways: true, // the Pokéball badge stays, only its shiny variant marks a shiny
        },
        'party list': {
            sparkle: '#pokemonListContainer sup[data-bind*="$data.shiny"]',
            data: (id) => App.game.party.getPokemon(id),
        },
    };
    const bound = {};
    for (const [label, fragment] of Object.entries(fragments)) {
        const sparkle = document.querySelector(fragment.sparkle);
        const stars = sparkle?.nextElementSibling;
        check(`${label}: stars element next to the game's ✨`, sparkle && stars?.classList.contains('sv-stars'), sparkle ? stars?.outerHTML?.slice(0, 120) : 'template not found');
        if (!sparkle || !stars) {
            continue;
        }
        bound[label] = {};
        for (const id of Object.keys(expected).map(Number)) {
            const holder = document.createElement('div');
            holder.append(sparkle.cloneNode(true), stars.cloneNode(true));
            document.body.append(holder);
            ko.applyBindings(fragment.data(id), holder);
            bound[label][id] = { sparkle: holder.firstElementChild, stars: holder.lastElementChild, always: !!fragment.sparkleAlways };
        }
    }

    const verify = () => {
        const on = ShinyVariants.settings.stars();
        for (const [label, byId] of Object.entries(bound)) {
            for (const [id, count] of Object.entries(expected)) {
                const { sparkle, stars, always } = byId[id];
                const drawn = stars.style.display === 'none' ? 0 : stars.querySelectorAll('svg.sv-star').length;
                const titles = [...stars.querySelectorAll('svg.sv-star title')].map((title) => title.textContent);
                const sparkleShown = sparkle.style.display !== 'none';
                const okStars = drawn === (on ? count : 0);
                const okSparkle = sparkleShown === (always || (!on && count > 0));
                check(`${label} #${id}: ${on ? `${count} star(s)` : 'the game\'s ✨'}`, okStars && okSparkle, `${drawn} star(s) ${JSON.stringify(titles)}, ✨ ${sparkleShown ? 'shown' : 'hidden'}`);
            }
        }
    };

    (async () => {
        await wait(50);
        verify();
        ShinyVariants.settings.stars(false);
        await wait(50);
        verify();
        ShinyVariants.settings.stars(true);
        await wait(50);
        const pikachu = bound['Hatchery card']?.[25]?.stars;
        check('Hatchery card #25: rare then epic, epic on the left', pikachu && [...pikachu.querySelectorAll('title')].map((t) => t.textContent).join(' | ') === 'Rare shiny palette | Epic shiny palette' && getComputedStyle(pikachu).flexDirection === 'row-reverse', pikachu?.innerHTML.slice(0, 200));
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
