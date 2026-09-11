// Scenario for tools/realgame/start.mjs, with oakcharms (and optionally oakitemsoverload,
// in either order): the four charms exist with their own ten levels, bonuses, costs and
// experience; a level past 5 is bought through the game's own upgrade path, kept out of
// the save in the charms' side store, and restored on reload. The Dowsing Charm feeds
// the game's rare item multiplier, gains exp from held item drops and rare chests, and
// scales the chest "more loot" roll of a real dungeon.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const item = (key) => App.game.oakItems.itemList[OakItemType[key]];
    const quest = item('Quest_Charm');
    const farm = item('Farm_Charm');
    const battle = item('Battle_Charm');
    const dowsing = item('Dowsing_Charm');
    const charms = [quest, farm, battle, dowsing];

    // Definitions
    check('the four charms exist', charms.every((charm) => charm !== undefined));
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
    quest.fromJSON({ level: 7, exp: 30000, isActive: false });

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

    // The save stays vanilla; the side store keeps the charms at level 7 and 3
    const save = App.game.oakItems.toJSON();
    check('save holds no charm', save.Quest_Charm === undefined && save.Farm_Charm === undefined && save.Battle_Charm === undefined && save.Dowsing_Charm === undefined);
    const stored = JSON.parse(localStorage.getItem(`oakCharms-${Save.key}`));
    check('side store holds levels 7 and 3', stored?.Quest_Charm?.level === 7 && stored.Quest_Charm.exp === 30000 && stored.Dowsing_Charm?.level === 3, JSON.stringify(stored));

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
    check('the new game registered the multiplier once', App.game.multiplier.multipliers.rareItemDropRate.filter((m) => m.source === 'Dowsing Charm').length === 1);

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
    const near = (value, expected) => Math.abs(value - expected) < 1e-9;
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
