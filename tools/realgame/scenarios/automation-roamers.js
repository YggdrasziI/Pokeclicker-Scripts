// Scenario for tools/realgame/start.mjs, with pokeclickerautomation: check the 'Roamers'
// focus topic against the real game. A fresh save misses Mew, the Kanto roamer, so the
// topic must target the boosted Kanto route; once every roamer is caught it must report
// nothing left and expose the follow-up topics the settings enable.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };

    const focus = Automation.Focus;
    const roamers = focus.Roamers;
    const storage = Automation.Utils.LocalStorage;

    // Drop-down entry and settings tab
    const option = document.getElementById('Roamers');
    check('topic listed in the focus drop-down', option !== null && option.value === 'Roamers' && !option.hidden);
    const followUpKeys = roamers.__internal__followUpTopics.map((t) => roamers.__internal__getFollowUpSettingKey(t.id));
    check('shiny toggle built', document.getElementById(roamers.__internal__advancedSettings.HuntShinies) !== null);
    check('one toggle per follow-up topic', followUpKeys.every((key) => document.getElementById(key) !== null), followUpKeys.length);
    check('every setting defaults to off',
        [roamers.__internal__advancedSettings.HuntShinies, ...followUpKeys].every((key) => storage.getValue(key) === 'false'));
    check('every follow-up id is a real topic',
        roamers.__internal__followUpTopics.every((t) => focus.__internal__functionalities.some((f) => f.id === t.id)));

    // Target selection on a fresh save: Mew is missing in Kanto's first group
    const missing = roamers.__internal__getMissingRoamers(GameConstants.Region.kanto, 0, false);
    check('Mew is missing on a fresh save', missing.some((r) => r.pokemon.name === 'Mew'), missing.map((r) => r.pokemon.name).join(','));
    const target = roamers.__internal__findNextTarget();
    check('a Kanto target is found', target !== null && target.region === GameConstants.Region.kanto && target.group === 0);
    check('the first pass hunts uncaught roamers', target !== null && target.untilShinyCaught === false);
    storage.setValue(roamers.__internal__advancedSettings.HuntShinies, true);
    check('shiny mode still starts with the uncaught pass', roamers.__internal__findNextTarget()?.untilShinyCaught === false);
    storage.setValue(roamers.__internal__advancedSettings.HuntShinies, false);
    const boosted = RoamingPokemonList.getIncreasedChanceRouteBySubRegionGroup(GameConstants.Region.kanto, 0)();
    const reachable = Routes.getRoutesByRegion(GameConstants.Region.kanto)
        .filter((r) => RoamingPokemonList.findGroup(GameConstants.Region.kanto, r.subRegion ?? 0) === 0 && r.isUnlocked());
    const expected = reachable.includes(boosted) ? boosted : reachable[reachable.length - 1];
    check('the boosted route is picked when reachable, else the last reachable one',
        target !== null && target.route === expected,
        `boosted=${boosted?.number} reachable=${reachable.map((r) => r.number).join(',')} picked=${target?.route?.number}`);

    // The catch filter only concerns missing roamers
    // (the filter object is rebuilt when it is re-prioritized, so fetch it after each call)
    const automationFilter = () => App.game.pokeballFilters.getFilterByName('Automation');
    Automation.Utils.Pokeball.onlyCatchMissingRoamersWith(GameConstants.Pokeball.Pokeball, false);
    let filter = automationFilter();
    check('filter restricted to uncaught roamers',
        filter.enabled() && filter.options.encounterType?.observableValue() === EncounterType.roamer
        && filter.options.caught?.observableValue() === false && filter.options.caughtShiny === undefined);
    Automation.Utils.Pokeball.onlyCatchMissingRoamersWith(GameConstants.Pokeball.Pokeball, true);
    filter = automationFilter();
    check('shiny mode restricts to roamers whose shiny is not caught',
        filter.enabled() && filter.options.encounterType?.observableValue() === EncounterType.roamer
        && filter.options.caughtShiny?.observableValue() === false && filter.options.caught === undefined);
    Automation.Utils.Pokeball.disableAutomationFilter();

    // Once every roaming pokémon of the group is caught (an event roamer may be around too),
    // nothing is left in a Kanto-only save
    for (const roamer of missing) {
        App.game.party.gainPokemonByName(roamer.pokemon.name, false, true);
    }
    check('catching them closes the group', roamers.__internal__getMissingRoamers(GameConstants.Region.kanto, 0, false).length === 0);
    check('no target left', roamers.__internal__findNextTarget() === null);

    // In shiny mode, the second pass takes over: they are missing again until their shiny form is caught
    storage.setValue(roamers.__internal__advancedSettings.HuntShinies, true);
    check('shiny mode reopens the group', roamers.__internal__getMissingRoamers(GameConstants.Region.kanto, 0, true).some((r) => r.pokemon.name === 'Mew'));
    check('the second pass hunts shinies', roamers.__internal__findNextTarget()?.untilShinyCaught === true);
    for (const roamer of missing) {
        App.game.party.gainPokemonByName(roamer.pokemon.name, true, true);
    }
    check('shiny forms close it again', roamers.__internal__findNextTarget() === null);
    storage.setValue(roamers.__internal__advancedSettings.HuntShinies, false);

    // Follow-up topics come from the toggles, in the listed order, and feed the fallback chain
    const topic = focus.__internal__functionalities.find((f) => f.id === 'Roamers');
    check('no follow-up by default', topic.fallbackTopics().length === 0);
    storage.setValue(roamers.__internal__getFollowUpSettingKey('XP'), true);
    storage.setValue(roamers.__internal__getFollowUpSettingKey('PokerusCure'), true);
    check('enabled follow-ups listed in order', topic.fallbackTopics().join(',') === 'PokerusCure,XP');
    focus.__internal__wantedTopicId = 'Roamers';
    focus.__internal__blockedTopics.set('Roamers', { reason: 'test', blockedAt: Date.now() });
    // Pokérus cure is locked on a fresh save (no Pokérus virus), so the chain lands on XP
    check('blocked roamers hand over to the first unlocked follow-up', focus.__internal__findBestAvailableTopic()?.id === 'XP');
    focus.__internal__blockedTopics.clear();
    focus.__internal__wantedTopicId = null;

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
