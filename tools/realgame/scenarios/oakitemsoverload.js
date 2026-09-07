// Scenario for tools/realgame/start.mjs, with oakitemsoverload (and optionally oakcharms,
// in either order): the listed Oak Items go to level 10 with the extra bonuses, costs
// and experience; the others keep the game's maximum; an overloaded level is bought
// through the game's own upgrade path, kept out of the save, and restored on reload.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const item = (key) => App.game.oakItems.itemList[OakItemType[key]];

    // Extension
    const coin = item('Amulet_Coin');
    check('Amulet Coin goes to level 10', coin.maxLevel === 10 && coin.overloadBaseMaxLevel === 5);
    check('bonus list extended to 2.0x', coin.bonusList.length === 11 && coin.bonusList[10] === 2.0 && coin.bonusList[5] === 1.5);
    check('costs are 10M .. 5B Pokedollars',
        coin.costList.length === 10 && coin.costList[5].amount === 10000000 && coin.costList[9].amount === 5000000000
        && coin.costList[9].currency === GameConstants.Currency.money);
    check('experience doubles per level', coin.expList.length === 10 && coin.expList[5] === 20000 && coin.expList[9] === 320000);
    check('Magic Ball reaches 20%', item('Magic_Ball').bonusList[10] === 20 && item('Magic_Ball').maxLevel === 10);
    check('Cell Battery experience follows its own list', item('Cell_Battery').expList[5] === 300 && item('Cell_Battery').expList[9] === 4800);
    check('EXP Share reaches 1.75x', item('Exp_Share').maxLevel === 10 && item('Exp_Share').bonusList[10] === 1.75);
    check('Squirtbottle keeps the game maximum', item('Squirtbottle').maxLevel === 5 && item('Squirtbottle').overloadBaseMaxLevel === undefined);
    check('Sprinklotad keeps the game maximum', item('Sprinklotad').maxLevel === 5);
    if (OakItemType.Quest_Charm !== undefined) {
        check('Quest Charm reaches 3.5x', item('Quest_Charm').maxLevel === 10 && item('Quest_Charm').bonusList[10] === 3.5);
        check('Battle Charm costs scale from its own last cost', item('Battle_Charm').costList[9].amount === 500000000 * 5000);
    } else {
        out.push('     (Oak Charms not loaded, charms skipped)');
    }

    // Level 5 is no longer the end: the upgrade needs the next experience step
    coin.fromJSON({ level: 5, exp: 10000, isActive: true });
    check('level 5 is not max any more', !coin.isMaxLevel() && coin.calculateCost().amount === 10000000);
    check('no experience yet toward level 6', !coin.hasEnoughExp() && coin.progressString === '0 / 10,000');
    coin.gainExp(10000);
    check('experience is capped at the next step', coin.hasEnoughExp() && coin.expPercentage === 100);
    App.game.wallet.gainMoney(10000000, true);
    const before = App.game.wallet.currencies[GameConstants.Currency.money]();
    coin.buy();
    check('bought level 6 for 10M', coin.level === 6 && App.game.wallet.currencies[GameConstants.Currency.money]() === before - 10000000);
    check('bonus is 1.6x when active', coin.calculateBonus() === 1.6);
    check('counted as max level for the achievements', App.game.oakItems.maxLevelOakItems() === 1);
    coin.fromJSON({ level: 10, exp: 320000, isActive: true });
    check('level 10 is the end', coin.isMaxLevel() && coin.calculateBonus() === 2.0);
    coin.fromJSON({ level: 6, exp: 20000, isActive: true });

    // A charm's overloaded level travels through the Oak Charms store, whatever the load order
    if (OakItemType.Quest_Charm !== undefined) {
        item('Quest_Charm').fromJSON({ level: 7, exp: 4000, isActive: false });
        check('Quest Charm set to level 7', item('Quest_Charm').level === 7);
    }

    // The save keeps the game's maximum; the side store keeps the real level
    const save = App.game.oakItems.toJSON();
    check('save holds level 5 with its full experience', save.Amulet_Coin.level === 5 && save.Amulet_Coin.exp === 10000);
    const stored = JSON.parse(localStorage.getItem(`oakItemsOverload-${Save.key}`));
    check('side store holds level 6', stored?.Amulet_Coin?.level === 6 && stored.Amulet_Coin.exp === 20000, JSON.stringify(stored));
    check('nothing else stored', Object.keys(stored).length === 1);

    // Reload the game from that save: level 6 comes back from the store
    const saveObject = Save.getSaveObject();
    check('game save object stays at level 5', saveObject.oakItems.Amulet_Coin.level === 5);
    localStorage.setItem(`save${Save.key}`, JSON.stringify(saveObject));
    localStorage.setItem(`player${Save.key}`, JSON.stringify(player));
    App.game = new Game();
    App.game.initialize();
    const reloaded = item('Amulet_Coin');
    check('level 6 restored after reload', reloaded.level === 6 && reloaded.maxLevel === 10 && reloaded.calculateBonusIfActive() === 1.6);
    check('still counted as max level', App.game.oakItems.maxLevelOakItems() === (OakItemType.Quest_Charm !== undefined ? 2 : 1));
    if (OakItemType.Quest_Charm !== undefined) {
        check('Quest Charm level 7 restored after reload', item('Quest_Charm').level === 7 && item('Quest_Charm').calculateBonusIfActive() === 2.75);
    }

    // A save levelled down below the maximum is left alone
    localStorage.setItem(`oakItemsOverload-${Save.key}`, JSON.stringify({ Amulet_Coin: { level: 8, exp: 80000 } }));
    saveObject.oakItems.Amulet_Coin.level = 3;
    localStorage.setItem(`save${Save.key}`, JSON.stringify(saveObject));
    App.game = new Game();
    App.game.initialize();
    check('a save below the maximum ignores the store', item('Amulet_Coin').level === 3);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
