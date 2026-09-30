// Scenario for tools/realgame/start.mjs, with oakcharms (and optionally customachievements for
// the achievement checks, and oakitemsoverload,
// in either order): the six charms exist with their own ten levels, bonuses, costs and
// experience; a level past 5 is bought through the game's own upgrade path, kept out of
// the save in the charms' side store, and restored on reload. The Dowsing Charm feeds
// the game's rare item multiplier, gains exp from held item drops and rare chests, and
// scales the chest "more loot" roll of a real dungeon. The Roaming Charm feeds the
// game's roaming multiplier, gains exp and counts its uses on roaming encounters. The
// Mining Charm multiplies the experience of a completed mine layer, not of an item find.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const item = (key) => App.game.oakItems.itemList[OakItemType[key]];
    const near = (value, expected) => Math.abs(value - expected) < 1e-9;
    const quest = item('Quest_Charm');
    const farm = item('Farm_Charm');
    const battle = item('Battle_Charm');
    const dowsing = item('Dowsing_Charm');
    const roaming = item('Roaming_Charm');
    const mining = item('Mining_Charm');
    const charms = [quest, farm, battle, dowsing, roaming, mining];

    // Definitions
    check('the six charms exist', charms.every((charm) => charm !== undefined));
    check('ten levels each', charms.every((charm) => charm.maxLevel === 10 && charm.bonusList.length === 11 && charm.costList.length === 10 && charm.expList.length === 10));
    check('not touched by Oak Items Overload', charms.every((charm) => charm.overloadBaseMaxLevel === undefined));
    check('Quest Charm bonuses 1.15x .. 2.25x .. 3.5x', quest.bonusList[0] === 1.15 && quest.bonusList[5] === 2.25 && quest.bonusList[10] === 3.5);
    check('Quest Charm costs 1M .. 20M .. 100B', quest.costList[0].amount === 1000000 && quest.costList[4].amount === 20000000 && quest.costList[5].amount === 200000000 && quest.costList[9].amount === 100000000000
        && quest.costList[9].currency === GameConstants.Currency.money);
    check('Quest Charm experience 10 .. 1,000 .. 300,000', quest.expList[0] === 10 && quest.expList[4] === 1000 && quest.expList[5] === 3000 && quest.expList[9] === 300000);
    check('Farm Charm reaches 2.5x for 7.5B', farm.bonusList[10] === 2.5 && farm.costList[9].amount === 7500000000 && farm.expList[9] === 75000000);
    check('Battle Charm reaches 3.5x for 2.5T', battle.bonusList[10] === 3.5 && battle.costList[9].amount === 2500000000000 && battle.expList[9] === 25000);
    check('Dowsing Charm 1.1x .. 1.5x, the Dowsing Machine value, for 12.5B', dowsing.bonusList[0] === 1.1 && dowsing.bonusList[5] === 1.3 && dowsing.bonusList[10] === 1.5
        && dowsing.costList[0].amount === 100000 && dowsing.costList[9].amount === 12500000000 && dowsing.costList[9].currency === GameConstants.Currency.money
        && dowsing.expList[0] === 25 && dowsing.expList[9] === 50000);
    check('Dowsing Charm is locked before Hoenn', !dowsing.isUnlocked() && dowsing.hint() === 'Reach the Hoenn region');
    check('Roaming Charm 1.5x .. 2x .. 3x, the boosted route value, on the Shiny Charm\'s lists', roaming.bonusList[0] === 1.5 && roaming.bonusList[5] === 2 && roaming.bonusList[10] === GameConstants.ROAMING_INCREASED_CHANCE
        && roaming.costList[0].amount === 50000 && roaming.costList[4].amount === 1000000 && roaming.costList[5].amount === 10000000 && roaming.costList[9].amount === 5000000000
        && roaming.costList[9].currency === GameConstants.Currency.money
        && roaming.expList[0] === 600 && roaming.expList[4] === 10350 && roaming.expList[5] === 32850 && roaming.expList[9] === 782850 && roaming.expGain === 150);
    check('Roaming Charm progress counts roamers, 4 for the first level', roaming.progressString === '0 / 4');
    roaming.fromJSON({ level: 6, exp: 32850, isActive: false });
    check('Roaming Charm level 6 needs 500 roamers', roaming.progressString === '0 / 500', roaming.progressString);
    roaming.fromJSON({ level: 7, exp: 100000, isActive: false });
    check('a stored exp below its level is raised to the level start', roaming.normalizedExp === 0 && roaming.progressString === '0 / 1,000', roaming.progressString);
    roaming.fromJSON({ level: 7, exp: 300000, isActive: false });
    check('a stored exp above its level is capped to the next step', roaming.hasEnoughExp() && roaming.progressString === '1,000 / 1,000', roaming.progressString);
    roaming.fromJSON({ level: 0, exp: 0, isActive: false });
    check('Mining Charm 1.2x .. 2x .. 4x for 12.5B, one exp per layer', mining.bonusList[0] === 1.2 && mining.bonusList[5] === 2 && mining.bonusList[10] === 4
        && mining.costList[0].amount === 100000 && mining.costList[9].amount === 12500000000 && mining.costList[9].currency === GameConstants.Currency.money
        && mining.expList[0] === 10 && mining.expList[4] === 250 && mining.expList[9] === 75000 && mining.expGain === 1 && mining.progressString === '0 / 10');
    check('Mining Charm is locked before 100 layers mined', !mining.isUnlocked() && mining.hint() === 'Mine 100 layers in the Underground');
    App.game.statistics.undergroundLayersMined(100);
    check('Mining Charm unlocks at 100 layers mined', mining.isUnlocked());
    App.game.statistics.undergroundLayersMined(0);
    check('Roaming Charm is locked before 70 unique Pokémon', !roaming.isUnlocked() && roaming.hint() === 'Capture 70 unique Pokémon');

    // Level 5 is not the end: the upgrade needs the next experience step and costs 200M
    quest.fromJSON({ level: 5, exp: 1000, isActive: true });
    check('level 5 is not max', !quest.isMaxLevel() && quest.calculateCost().amount === 200000000);
    check('no experience yet toward level 6', !quest.hasEnoughExp() && quest.progressString === '0 / 2,000');
    quest.gainExp(2000);
    check('experience is capped at the next step', quest.hasEnoughExp() && quest.expPercentage === 100);
    App.game.wallet.gainMoney(200000000, true);
    const before = App.game.wallet.currencies[GameConstants.Currency.money]();
    quest.buy();
    check('bought level 6 for 200M', quest.level === 6 && App.game.wallet.currencies[GameConstants.Currency.money]() === before - 200000000);
    check('bonus is 2.5x when active', quest.calculateBonus() === 2.5);
    quest.fromJSON({ level: 10, exp: 300000, isActive: true });
    check('level 10 is the end', quest.isMaxLevel() && quest.calculateBonus() === 3.5);
    check('the only max-level item is the charm', App.game.oakItems.itemList.filter((i) => i.isMaxLevel()).length === 1);
    check('a max-level charm never counts for the game\'s achievements', App.game.oakItems.maxLevelOakItems() === 0);

    // The charm achievements, in their own category, count the charms at level 5 and 10
    if (typeof CustomAchievements !== 'undefined') {
        const achievement = (name) => AchievementHandler.achievementList.find((a) => a.name === name);
        const five = achievement('Charmed, I\'m Sure');
        const ten = achievement('Charm Overload');
        const allTen = achievement('Charm Offensive');
        check('charm achievements registered', five !== undefined && ten !== undefined && allTen?.property.requiredValue === 6 && achievement('Full Charm Bracelet')?.property.requiredValue === 6);
        check('a tier at 3 charms in both series', achievement('Third Time\'s the Charm')?.property.requiredValue === 3 && achievement('Triple Charm Overload')?.property.requiredValue === 3);
        check('tiers at 4 and 5 charms in both series', achievement('Four-Leaf Charm')?.property.requiredValue === 4 && achievement('High Five Charms')?.property.requiredValue === 5
            && achievement('Quadruple Charm Overload')?.property.requiredValue === 4 && achievement('Quintuple Charm Overload')?.property.requiredValue === 5);
        check('in their own category', five.category.name === 'oakCharms' && five.category !== achievement('Is That How I Use This?').category);
        check('one charm at level 10 completes the first tiers', five.property.getProgress() === 1 && five.isCompleted() && ten.isCompleted() && allTen.property.getProgress() === 1 && !allTen.isCompleted());
        check('the game\'s own achievement sees no max-level item', achievement('Is That How I Use This?').property.getProgress() === 0);
        const roamSweetRoam = achievement('Roam Sweet Roam');
        check('roamer achievements registered, 100 .. 10,000, in the same category', roamSweetRoam?.property.requiredValue === 100 && roamSweetRoam.category === five.category
            && achievement('Born to Roam')?.property.requiredValue === 1000 && achievement('Legends Never Rest')?.property.requiredValue === 10000);
        roaming.fromJSON({ level: 1, exp: 0, isActive: true, uses: 100 });
        check('100 roamers met complete Roam Sweet Roam', roamSweetRoam.property.getProgress() === 100 && roamSweetRoam.isCompleted() && !achievement('Born to Roam').isCompleted());
        roaming.fromJSON({ level: 0, exp: 0, isActive: false });
        check('the count reads 0 from a store without it', roaming.uses === 0 && roamSweetRoam.property.getProgress() === 0);
        const diggingDeep = achievement('Digging Deep');
        check('layer achievements registered, 100 .. 10,000, in the same category', diggingDeep?.property.requiredValue === 100 && diggingDeep.category === five.category
            && achievement('Tunnel Vision')?.property.requiredValue === 1000 && achievement('Journey to the Center of the Earth')?.property.requiredValue === 10000);
        mining.fromJSON({ level: 1, exp: 10, isActive: true, uses: 99 });
        UndergroundController.notifyMineCompleted();
        UndergroundController.addPlayerUndergroundExp(GameConstants.UNDERGROUND_EXPERIENCE_CLEAR_LAYER, true);
        check('the 100th layer completes Digging Deep', diggingDeep.property.getProgress() === 100 && diggingDeep.isCompleted() && !achievement('Tunnel Vision').isCompleted());
        mining.fromJSON({ level: 0, exp: 0, isActive: false });
        check('the layer count reads 0 from a store without it', mining.uses === 0 && diggingDeep.property.getProgress() === 0);
    } else {
        out.push('     (Custom Achievements not loaded, achievements skipped)');
    }
    quest.fromJSON({ level: 7, exp: 30000, isActive: false });

    // A charm turned off in the Scripts settings is locked, unequipped at once, and
    // never equipped from the store; it keeps its level. Applied at once.
    player.highestRegion(GameConstants.Region.johto);
    check('the Quest Charm unlocks in Johto', quest.isUnlocked() && quest.hint() === 'Reach the Johto region');
    const questSwitch = document.getElementById('checkbox-oakCharms-Quest_Charm');
    check('a settings switch per charm, on by default', questSwitch?.checked === true && document.getElementById('checkbox-oakCharms-Roaming_Charm')?.checked === true);
    quest.isActive = true;
    questSwitch.checked = false;
    questSwitch.dispatchEvent(new Event('change'));
    check('turned off: locked with a hint, and unequipped', !quest.isUnlocked() && quest.hint() === 'Turned off in the Scripts settings' && !quest.isActive);
    check('the choice is stored', JSON.parse(localStorage.getItem('oakCharmsEnabled'))?.Quest_Charm === false);
    quest.isActive = true;
    App.game.oakItems.fromJSON(App.game.oakItems.toJSON());
    check('a store equipping a charm turned off is unequipped on load, level kept', !quest.isActive && quest.level === 7);
    questSwitch.checked = true;
    questSwitch.dispatchEvent(new Event('change'));
    check('turned back on: unlocked, level kept', quest.isUnlocked() && quest.hint() === 'Reach the Johto region' && quest.level === 7
        && JSON.parse(localStorage.getItem('oakCharmsEnabled')).Quest_Charm === true);
    player.highestRegion(GameConstants.Region.kanto);

    // The Dowsing Charm is the game's rare item multiplier (1 on a fresh save: no Pickup aura)
    check('rare item multiplier is 1 with the charm unequipped', App.game.multiplier.getBonus('rareItemDropRate') === 1);
    dowsing.fromJSON({ level: 10, exp: 50000, isActive: true });
    check('rare item multiplier is 1.5 at level 10', App.game.multiplier.getBonus('rareItemDropRate') === 1.5);
    dowsing.fromJSON({ level: 3, exp: 250, isActive: true });
    check('rare item multiplier follows the level', App.game.multiplier.getBonus('rareItemDropRate') === 1.22);
    App.game.multiplier.getBonus('rareItemDropRate', true);
    check('reading the multiplier grants no experience', dowsing.normalizedExp === 0);

    // Chest loot through the game's dispatcher: rare 1, epic 2, legendary 3, mythic 5, common 0
    const expAfterLoot = (weight) => {
        const start = dowsing.normalizedExp;
        DungeonRunner.gainLoot('xAttack', 1, weight);
        return dowsing.normalizedExp - start;
    };
    check('a rare chest gives 1 exp', expAfterLoot(3) === 1);
    check('an epic chest gives 2 exp', expAfterLoot(2) === 2);
    check('a legendary chest gives 3 exp', expAfterLoot(1) === 3);
    check('a mythic chest gives 5 exp', expAfterLoot(0) === 5);
    check('a common chest gives nothing', expAfterLoot(4) === 0);
    dowsing.fromJSON({ level: 3, exp: 250, isActive: false });
    check('an unequipped charm gains nothing from chests', expAfterLoot(3) === 0);

    // Held items dropped by defeated Pokémon: one exp each, only while equipped
    const enemy = (heldItem) => new BattlePokemon('Pikachu', 25, PokemonType.Electric, PokemonType.None, 10, 1, 1, 1, undefined,
        false, 1, 0, GameConstants.ShadowStatus.None, EncounterType.route, heldItem);
    const expAfterDefeat = (heldItem) => {
        const start = dowsing.normalizedExp;
        enemy(heldItem).defeat();
        return dowsing.normalizedExp - start;
    };
    dowsing.fromJSON({ level: 3, exp: 250, isActive: true });
    const xAttacks = player.itemList.xAttack();
    check('a held item drop gives 1 exp', expAfterDefeat({ type: ItemType.item, id: 'xAttack' }) === 1 && player.itemList.xAttack() === xAttacks + 1);
    check('a Pokémon without held item gives nothing', expAfterDefeat(undefined) === 0);
    dowsing.fromJSON({ level: 3, exp: 250, isActive: false });
    check('an unequipped charm gains nothing from drops', expAfterDefeat({ type: ItemType.item, id: 'xAttack' }) === 0);

    // The Roaming Charm is the game's roaming multiplier (1 on a fresh save: no Roaming aura)
    check('roaming multiplier is 1 with the charm unequipped', App.game.multiplier.getBonus('roaming') === 1);
    const route = Routes.getRoute(GameConstants.Region.kanto, 1);
    const rateUnequipped = PokemonFactory.roamingRate(route);
    roaming.fromJSON({ level: 10, exp: 782850, isActive: true });
    check('roaming multiplier is 3 at level 10', App.game.multiplier.getBonus('roaming') === 3);
    check('the route\'s roaming odds are three times better at level 10', rateUnequipped > 0 && near(PokemonFactory.roamingRate(route), rateUnequipped / 3), `${rateUnequipped} -> ${PokemonFactory.roamingRate(route)}`);
    roaming.fromJSON({ level: 2, exp: 1000, isActive: true });
    check('roaming multiplier follows the level', App.game.multiplier.getBonus('roaming') === 1.7);
    App.game.multiplier.getBonus('roaming', true);
    check('reading the multiplier grants no experience nor use', roaming.normalizedExp === 0 && roaming.uses === 0);

    // The route's encounters window marks the charm's share next to the roaming odds.
    // Its content is rendered by the "if" on the modal state: a fresh save stands on
    // Kanto route 1, where Mew roams. start.mjs never applies the game's bindings, so
    // bind the window alone, with the game's own view model; updates are deferred.
    const routeWindow = document.getElementById('routeInfoModal');
    const charmMark = () => routeWindow.querySelector('.oakcharms-roaming-bonus');
    const roamingTooltip = () => String($(charmMark()?.parentElement).data('bs.tooltip')?.config.title ?? '');
    const openRouteWindow = (open) => {
        DisplayObservables.modalState.routeInfoModalObservable(open ? 'show' : 'hidden');
        ko.tasks.runEarly();
    };
    const setRoaming = (json) => {
        roaming.fromJSON(json);
        ko.tasks.runEarly();
    };
    check('the route window template carries the charm\'s mark', charmMark() !== null && charmMark().previousElementSibling?.getAttribute('data-bind') === 'visible: isBoosted');
    ko.applyBindings(App.game, routeWindow);
    check('the route window is empty while closed', charmMark() === null);
    openRouteWindow(true);
    check('the route window shows +70% at level 2', charmMark()?.textContent === '+70%' && charmMark().style.display !== 'none', `${player.region}/${player.route}: ${charmMark()?.outerHTML}`);
    check('the roaming tooltip has the charm\'s line', roamingTooltip().includes('Roaming Charm: +70% (×1.7)'), roamingTooltip());
    check('the roaming odds shown count the charm', routeWindow.textContent.includes(`1 / ${Math.floor(PokemonFactory.roamingRate(Routes.getRoute(player.region, player.route))).toLocaleString('en-US')} `));
    setRoaming({ level: 10, exp: 782850, isActive: true });
    check('the route window shows +200% at level 10', charmMark()?.textContent === '+200%', charmMark()?.textContent);
    setRoaming({ level: 2, exp: 1000, isActive: false });
    check('the route window hides the mark of an unequipped charm', charmMark()?.style.display === 'none', charmMark()?.outerHTML);
    openRouteWindow(false);
    check('the route window content is dropped when it closes', charmMark() === null);
    roaming.fromJSON({ level: 2, exp: 1000, isActive: true });

    // Roaming encounters through the game's own roll: Mew roams Kanto from the start, an
    // event roamer may too.
    // The roll is the Rand.chance call of generateRoamingEncounter, forced by a spy.
    const roamingEncounter = (rolls) => {
        Rand.chance = () => rolls;
        const start = { exp: roaming.normalizedExp, uses: roaming.uses };
        try {
            const result = PokemonFactory.generateRoamingEncounter(1, GameConstants.Region.kanto);
            return { result, exp: roaming.normalizedExp - start.exp, uses: roaming.uses - start.uses };
        } finally {
            delete Rand.chance;
        }
    };
    let encounter = roamingEncounter(true);
    check('a roaming encounter gives 150 exp and one use', typeof encounter.result === 'string' && encounter.exp === 150 && encounter.uses === 1, JSON.stringify(encounter));
    encounter = roamingEncounter(false);
    check('a failed roll gives nothing', encounter.result === false && encounter.exp === 0 && encounter.uses === 0, JSON.stringify(encounter));
    roaming.fromJSON({ level: 2, exp: 1000, isActive: false, uses: 1 });
    encounter = roamingEncounter(true);
    check('an unequipped charm gains nothing from roamers', typeof encounter.result === 'string' && encounter.exp === 0 && encounter.uses === 0, JSON.stringify(encounter));
    roaming.fromJSON({ level: 10, exp: 782850, isActive: true, uses: 1 });
    encounter = roamingEncounter(true);
    check('a max-level charm still counts its uses', encounter.exp === 0 && encounter.uses === 1 && roaming.uses === 2, JSON.stringify(encounter));
    roaming.fromJSON({ level: 2, exp: 1000, isActive: true, uses: 2 });

    // Mine layers, through the calls UndergroundController.handleDig makes: an item find
    // gives its experience with share set, a completed layer notifies then gives its own
    const underground = App.game.underground;
    const layerExp = GameConstants.UNDERGROUND_EXPERIENCE_CLEAR_LAYER;
    const findExp = GameConstants.UNDERGROUND_EXPERIENCE_DIG_UP_ITEM;
    const playerExpAfter = (steps) => {
        const start = { player: underground.undergroundExp, charm: mining.normalizedExp, uses: mining.uses };
        steps();
        return { player: underground.undergroundExp - start.player, charm: mining.normalizedExp - start.charm, uses: mining.uses - start.uses };
    };
    const clearLayer = () => {
        UndergroundController.notifyMineCompleted();
        UndergroundController.addPlayerUndergroundExp(layerExp, true);
    };
    let dig = playerExpAfter(clearLayer);
    check('an unequipped charm leaves a layer at its 100 exp', dig.player === layerExp && dig.charm === 0 && dig.uses === 0, JSON.stringify(dig));
    mining.fromJSON({ level: 5, exp: 250, isActive: true });
    dig = playerExpAfter(clearLayer);
    check('level 5 doubles a layer, 1 charm exp and 1 use', dig.player === 2 * layerExp && dig.charm === 1 && dig.uses === 1, JSON.stringify(dig));
    dig = playerExpAfter(() => UndergroundController.addPlayerUndergroundExp(findExp, true));
    check('an item find is not multiplied and gives no charm exp', dig.player === findExp && dig.charm === 0 && dig.uses === 0, JSON.stringify(dig));
    mining.fromJSON({ level: 10, exp: 75000, isActive: true, uses: 1 });
    dig = playerExpAfter(clearLayer);
    check('level 10 gives four times a layer', dig.player === 4 * layerExp && dig.uses === 1, JSON.stringify(dig));
    dig = playerExpAfter(() => {
        UndergroundController.notifyMineCompleted({ name: 'helper' });
        UndergroundController.addHiredHelperUndergroundExp(layerExp, true);
    });
    const helperShare = Math.floor(+(4 * layerExp * GameConstants.HELPER_EXPERIENCE_PLAYER_FRACTION).toFixed(1));
    check('a layer a helper completes is multiplied too, the player\'s share with it', dig.player === helperShare && dig.uses === 1, `${JSON.stringify(dig)} vs ${helperShare}`);
    mining.fromJSON({ level: 4, exp: 100, isActive: true, uses: 3 });

    // The save stays vanilla; the side store keeps the charms at level 7, 3 and 2
    const save = App.game.oakItems.toJSON();
    check('save holds no charm', save.Quest_Charm === undefined && save.Farm_Charm === undefined && save.Battle_Charm === undefined && save.Dowsing_Charm === undefined && save.Roaming_Charm === undefined && save.Mining_Charm === undefined);
    const stored = JSON.parse(localStorage.getItem(`oakCharms-${Save.key}`));
    check('side store holds levels 7 and 3', stored?.Quest_Charm?.level === 7 && stored.Quest_Charm.exp === 30000 && stored.Dowsing_Charm?.level === 3, JSON.stringify(stored));
    check('side store holds the Mining Charm level and uses', stored?.Mining_Charm?.level === 4 && stored.Mining_Charm.uses === 3, JSON.stringify(stored?.Mining_Charm));
    check('side store holds the Roaming Charm level and uses', stored?.Roaming_Charm?.level === 2 && stored.Roaming_Charm.uses === 2, JSON.stringify(stored?.Roaming_Charm));

    // Reload: the levels come back from the store
    const saveObject = Save.getSaveObject();
    check('game save object holds no charm', saveObject.oakItems.Quest_Charm === undefined && saveObject.oakItems.Dowsing_Charm === undefined);
    localStorage.setItem(`save${Save.key}`, JSON.stringify(saveObject));
    localStorage.setItem(`player${Save.key}`, JSON.stringify(player));
    App.game = new Game();
    App.game.initialize();
    const reloaded = item('Quest_Charm');
    check('level 7 restored after reload', reloaded.level === 7 && reloaded.maxLevel === 10 && reloaded.calculateBonusIfActive() === 2.75);
    const reloadedDowsing = item('Dowsing_Charm');
    check('Dowsing Charm level 3 restored after reload', reloadedDowsing.level === 3 && reloadedDowsing.calculateBonusIfActive() === 1.22);
    const reloadedRoaming = item('Roaming_Charm');
    check('Roaming Charm level 2 and its 2 uses restored after reload', reloadedRoaming.level === 2 && reloadedRoaming.uses === 2 && reloadedRoaming.calculateBonusIfActive() === 1.7);
    check('the new game registered the multipliers once', App.game.multiplier.multipliers.rareItemDropRate.filter((m) => m.source === 'Dowsing Charm').length === 1
        && App.game.multiplier.multipliers.roaming.filter((m) => m.source === 'Roaming Charm').length === 1);

    // The chest "more loot" roll of a real dungeon. A fresh save cannot enter Viridian
    // Forest yet: ticket, tokens and Route 2. The roll is the first Rand.chance call of
    // openChest, recorded by a spy that also always fails it.
    App.game.keyItems.gainKeyItem(KeyItemType.Dungeon_ticket, true);
    App.game.wallet.gainDungeonTokens(10000000);
    App.game.statistics.routeKills[GameConstants.Region.kanto][1](GameConstants.ROUTE_KILLS_NEEDED);
    App.game.statistics.routeKills[GameConstants.Region.kanto][2](GameConstants.ROUTE_KILLS_NEEDED);
    App.game.party.gainPokemonById(1);
    App.game.pokeballs.calculatePokeballToUse = () => GameConstants.Pokeball.None;
    const dungeon = TownList['Viridian Forest'].dungeon;
    player.town = TownList['Viridian Forest'];
    App.game.gameState = GameConstants.GameState.town;
    check('the dungeon starts', DungeonRunner.initializeDungeon(dungeon) !== false);
    const openRiggedChest = (tier) => {
        const tile = DungeonRunner.map.currentTile();
        tile.type(GameConstants.DungeonTileType.chest);
        tile.metadata = { tier, loot: { loot: 'xAttack' } };
        const seen = [];
        Rand.chance = function (chance) {
            seen.push(chance);
            return false;
        };
        const spy = Rand.chance;
        const start = reloadedDowsing.normalizedExp;
        try {
            DungeonRunner.openChest();
        } finally {
            const restored = Rand.chance === spy;
            delete Rand.chance;
            seen.restored = restored;
        }
        seen.exp = reloadedDowsing.normalizedExp - start;
        return seen;
    };
    // rare: 0.5 / (4 / 4) / 1.5
    reloadedDowsing.fromJSON({ level: 3, exp: 250, isActive: false });
    let seen = openRiggedChest('rare');
    check('rare chest roll is 1/3 with the charm unequipped', seen.length === 1 && near(seen[0], 1 / 3) && seen.exp === 0, JSON.stringify(seen));
    reloadedDowsing.fromJSON({ level: 10, exp: 50000, isActive: true });
    seen = openRiggedChest('rare');
    check('rare chest roll is 1/2 at level 10, one roll, no exp past the last level', seen.length === 1 && near(seen[0], 0.5) && seen.exp === 0, JSON.stringify(seen));
    check('the spy was still in place after the chest', seen.restored === true);
    check('Rand.chance is back to the inherited one', !Object.prototype.hasOwnProperty.call(Rand, 'chance') && typeof Rand.chance === 'function');
    reloadedDowsing.fromJSON({ level: 3, exp: 250, isActive: true });
    seen = openRiggedChest('rare');
    check('rare chest roll is 1/3 x 1.22 at level 3, 1 exp', seen.length === 1 && near(seen[0], 1 / 3 * 1.22) && seen.exp === 1, JSON.stringify(seen));
    seen = openRiggedChest('common');
    // common: 0.5 / (4 / 5) / 1.5 = 0.41666.., times 1.22
    check('common chest roll scales by the level bonus, no exp', seen.length === 1 && near(seen[0], 0.5 / (4 / 5) / 1.5 * 1.22) && seen.exp === 0, JSON.stringify(seen));

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
