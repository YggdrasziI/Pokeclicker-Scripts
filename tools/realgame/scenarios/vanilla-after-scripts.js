// Scenario for tools/realgame/start.mjs, with NO script and --save=<the file written from
// scripts-save-export.js>: a save written with the Oak Charms, Oak Items Overload and
// Wither Mulch scripts still loads in the unmodified game, which is what happens to a
// player who removes the scripts. The game ignores what the scripts added, keeps its own
// data whole, and writes a plain save back.
//
// A feature that fails to load only logs "Unable to load sava data from JSON for: <key>"
// and goes on with defaults, which the next autosave would then write over the real
// data: the farm checks below would fail on those defaults.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const item = (key) => App.game.oakItems.itemList[OakItemType[key]];
    const farming = App.game.farming;

    check('no script is loaded', OakItemType.Quest_Charm === undefined && MulchType.Wither_Mulch === undefined && OakItems.prototype.overloadInstalled === undefined);

    // The save read by this game does hold the scripts' data
    const loaded = JSON.parse(localStorage.getItem(`save${Save.key}`));
    check('the loaded save holds the scripts\' data', loaded.oakItems.Quest_Charm?.level === 7 && loaded.oakItems.Amulet_Coin.overload?.level === 8 && loaded.farming.witherMulch === 3);

    // Oak Items: the game's own, at the game's own maximum
    const coin = item('Amulet_Coin');
    check('the overloaded item stands at the game\'s maximum', coin.level === 5 && coin.maxLevel === 5 && coin.isMaxLevel() && coin.isActive, `${coin.level} / ${coin.maxLevel}`);
    check('its experience is the game\'s last step', coin.toJSON().exp === coin.expList[4], coin.toJSON().exp);
    check('an item below the maximum keeps its level', item('Magic_Ball').level === 3);
    check('one max level item counted', App.game.oakItems.maxLevelOakItems() === 1);
    check('the item list holds the game\'s items only', App.game.oakItems.itemList.length === GameHelper.enumLength(OakItemType));

    // Farm: everything after the mulch list was read too
    check('the mulch list is the game\'s own', farming.mulchList.length === 7 && farming.mulchList[MulchType.Boost_Mulch]() === 2);
    const planted = farming.plotList.filter((plot) => plot.berry === BerryType.Cheri);
    check('the planted plot is still planted', planted.length === 1 && planted[0].isUnlocked);
    check('the shovels are still there', farming.shovelAmt() === 4, farming.shovelAmt());

    // What the game writes back is a plain save, and it loads again
    const save = Save.getSaveObject();
    check('the game writes the save without the scripts\' data', save.oakItems.Quest_Charm === undefined && save.oakItems.Amulet_Coin.overload === undefined && save.farming.witherMulch === undefined);
    check('and keeps its own', save.oakItems.Amulet_Coin.level === 5 && save.farming.shovelAmt === 4 && save.farming.plotList.some((plot) => plot.berry === BerryType.Cheri));
    localStorage.setItem(`save${Save.key}`, JSON.stringify(save));
    localStorage.setItem(`player${Save.key}`, JSON.stringify(player));
    App.game = new Game();
    App.game.initialize();
    check('the rewritten save loads again', item('Amulet_Coin').level === 5 && App.game.farming.shovelAmt() === 4);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
