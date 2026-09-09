// Scenario for tools/realgame/start.mjs, with oakcharms (and optionally oakitemsoverload,
// in either order): the three charms exist with their own ten levels, bonuses, costs and
// experience; a level past 5 is bought through the game's own upgrade path, kept out of
// the save in the charms' side store, and restored on reload.
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

    // Definitions
    check('the three charms exist', quest !== undefined && farm !== undefined && battle !== undefined);
    check('ten levels each', [quest, farm, battle].every((charm) => charm.maxLevel === 10 && charm.bonusList.length === 11 && charm.costList.length === 10 && charm.expList.length === 10));
    check('not touched by Oak Items Overload', [quest, farm, battle].every((charm) => charm.overloadBaseMaxLevel === undefined));
    check('Quest Charm bonuses 1.15x .. 2.25x .. 3.5x', quest.bonusList[0] === 1.15 && quest.bonusList[5] === 2.25 && quest.bonusList[10] === 3.5);
    check('Quest Charm costs 1M .. 20M .. 100B', quest.costList[0].amount === 1000000 && quest.costList[4].amount === 20000000 && quest.costList[5].amount === 200000000 && quest.costList[9].amount === 100000000000
        && quest.costList[9].currency === GameConstants.Currency.money);
    check('Quest Charm experience 10 .. 1,000 .. 300,000', quest.expList[0] === 10 && quest.expList[4] === 1000 && quest.expList[5] === 3000 && quest.expList[9] === 300000);
    check('Farm Charm reaches 2.5x for 7.5B', farm.bonusList[10] === 2.5 && farm.costList[9].amount === 7500000000 && farm.expList[9] === 75000000);
    check('Battle Charm reaches 3.5x for 2.5T', battle.bonusList[10] === 3.5 && battle.costList[9].amount === 2500000000000 && battle.expList[9] === 7500000);

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

    // The save stays vanilla; the side store keeps the charm at level 7
    quest.fromJSON({ level: 7, exp: 30000, isActive: false });
    const save = App.game.oakItems.toJSON();
    check('save holds no charm', save.Quest_Charm === undefined && save.Farm_Charm === undefined && save.Battle_Charm === undefined);
    const stored = JSON.parse(localStorage.getItem(`oakCharms-${Save.key}`));
    check('side store holds level 7', stored?.Quest_Charm?.level === 7 && stored.Quest_Charm.exp === 30000, JSON.stringify(stored));

    // Reload: the level comes back from the store
    const saveObject = Save.getSaveObject();
    check('game save object holds no charm', saveObject.oakItems.Quest_Charm === undefined);
    localStorage.setItem(`save${Save.key}`, JSON.stringify(saveObject));
    localStorage.setItem(`player${Save.key}`, JSON.stringify(player));
    App.game = new Game();
    App.game.initialize();
    const reloaded = item('Quest_Charm');
    check('level 7 restored after reload', reloaded.level === 7 && reloaded.maxLevel === 10 && reloaded.calculateBonusIfActive() === 2.75);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
