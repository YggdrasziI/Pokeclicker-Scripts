// Scenario for tools/realgame/start.mjs, with withermulch: the Wither Mulch is a mulch the
// farm lists and the berry shops sell; put on a plot it withers the plant at once through
// the game's own Plot.die, one mulch per plant, which is what drops the Banettite from a
// Kasib Berry. The save keeps the game's own mulch list, and the stock under a key of its own.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    // Every Rand.chance call answers `rolls`, the Banettite and replant rolls included
    const withRolls = (rolls, action) => {
        Rand.chance = () => rolls;
        try {
            return action();
        } finally {
            delete Rand.chance;
        }
    };
    let farming = App.game.farming;
    const type = MulchType.Wither_Mulch;
    const stock = () => farming.mulchList[type]();
    // The plot unlocked on a fresh save, in the middle of the farm
    const index = farming.plotList.findIndex((plot) => plot.isUnlocked);
    const plot = () => farming.plotList[index];

    // Definitions
    check('the enum has the mulch both ways, after Gooey', type === MulchType.Gooey_Mulch + 1 && MulchType[type] === 'Wither_Mulch');
    const item = ItemList.Wither_Mulch;
    check('the item costs 300 Farm Points', item instanceof MulchItem && item.type === type && item.basePrice === 300 && item.currency === GameConstants.Currency.farmPoint && item.displayName === 'Wither Mulch');
    check('the farm has a stock for it', typeof farming.mulchList[type] === 'function' && stock() === 0);
    const sellers = [pokeMartShop, ...Object.values(TownList).flatMap((town) => town.content)].filter((shop) => shop instanceof Shop && shop.items.some((i) => i instanceof MulchItem));
    const selling = sellers.filter((shop) => shop.items.some((i) => i instanceof MulchItem && i.type === type));
    check('every shop selling mulch sells it', sellers.length > 3 && selling.length === sellers.length, `${selling.length} / ${sellers.length}`);
    check('once per shop, right after the game\'s mulches', selling.every((shop) => {
        const mulches = shop.items.filter((i) => i instanceof MulchItem);
        return mulches.filter((i) => i.type === type).length === 1 && mulches[mulches.length - 1].type === type;
    }));
    const martCopy = pokeMartShop.items.find((i) => i instanceof MulchItem && i.type === type);
    const martFreeze = pokeMartShop.items.find((i) => i instanceof MulchItem && i.type === MulchType.Freeze_Mulch);
    check('the Poké Mart copy follows the farm shortcut visibility', martCopy !== item && martCopy.visible === martFreeze.visible);

    // The farm window lists it from the enum. start.mjs never applies the game's
    // bindings: bind the window alone, with the game's own view model.
    const farmModal = document.getElementById('farmModal');
    ko.applyBindings(App.game, farmModal);
    ko.tasks.runEarly();
    const listed = [...farmModal.querySelectorAll('img')].filter((img) => img.getAttribute('src')?.endsWith('items/farm/Wither_Mulch.png'));
    check('the farm window lists the mulch with its image', listed.length > 0 && farmModal.textContent.includes('Wither Mulch'), listed.length);

    // Buying
    App.game.wallet.gainFarmPoints(100000, true);
    const pointsBefore = App.game.wallet.currencies[GameConstants.Currency.farmPoint]();
    item.buy(3);
    check('buying 3 adds 3 to the stock for Farm Points', stock() === 3 && App.game.wallet.currencies[GameConstants.Currency.farmPoint]() < pointsBefore, stock());

    // An empty plot takes nothing
    check('an empty plot takes no mulch', farming.addMulch(index, type, 1) === false && stock() === 3);

    // A regular berry withers: half its harvest dropped, no replant, back to empty
    plot().plant(BerryType.Cheri);
    const cheri = farming.berryInventory[BerryType.Cheri]();
    // The farm window hands the selected mulch over as a string
    withRolls(false, () => farming.addMulch(index, String(type), 1));
    check('a Cheri plant withers for one mulch', plot().berry === BerryType.None && stock() === 2 && farming.berryInventory[BerryType.Cheri]() === cheri + 1);
    check('the plot is left without mulch', plot().mulch === MulchType.None && plot().mulchTimeLeft === 0);
    check('the use is counted, not per type', App.game.statistics.totalMulchesUsed() === 1 && App.game.statistics.mulchesUsed[type]() === 0);

    // Kasib: Kalos reached and Banette caught, the roll is the game's 5% (forced here)
    player.highestRegion(GameConstants.Region.kalos);
    App.game.party.gainPokemonByName('Banette', false, true);
    plot().plant(BerryType.Kasib);
    check('no Banettite yet', !player.hasMegaStone(GameConstants.MegaStoneType.Banettite));
    withRolls(true, () => farming.addMulch(index, type, 10));
    check('a withered Kasib drops the Banettite', player.hasMegaStone(GameConstants.MegaStoneType.Banettite));
    check('x10 still uses one mulch', stock() === 1, stock());
    check('the Kasib replants itself', plot().berry === BerryType.Kasib && plot().age === 0);

    // Mulch All: one per planted plot, as long as the stock lasts
    farming.mulchAll(type, 100);
    check('Mulch All withers the Kasib for its last mulch', stock() === 0);
    check('an empty stock withers nothing', farming.addMulch(index, type, 1) === false);
    const shovels = farming.mulchShovelAmt();
    check('the Mulch Shovel is untouched', farming.mulchShovelAmt() === shovels);

    // Safe-locked plots are left alone
    item.buy(1);
    farming.togglePlotSafeLock(index);
    check('a safe-locked plot takes no mulch', farming.addMulch(index, type, 1) === false && stock() === 1);
    farming.togglePlotSafeLock(index);

    // Other mulches still go through the game
    App.game.farming.mulchList[MulchType.Boost_Mulch](1);
    farming.addMulch(index, MulchType.Boost_Mulch, 1);
    check('a Boost Mulch still mulches the plot', plot().mulch === MulchType.Boost_Mulch && plot().mulchTimeLeft > 0);

    // The save keeps the game's own list, and the stock under its own key
    item.buy(4);
    const json = farming.toJSON();
    check('the save keeps 7 mulch entries, the last one 0', json.mulchList.length === 7 && json.mulchList[6] === 0, JSON.stringify(json.mulchList));
    check('the save holds the stock under its own key', json.witherMulch === 5, json.witherMulch);
    const mirrorKey = `withermulch-${Save.key}`;
    check('the mirror holds the stock', JSON.parse(localStorage.getItem(mirrorKey))?.stock === 5, localStorage.getItem(mirrorKey));
    const saveObject = Save.getSaveObject();
    check('the game save object keeps 7 entries and the stock', saveObject.farming.mulchList.length === 7 && saveObject.farming.witherMulch === 5);
    const reload = (farmingJson) => {
        localStorage.setItem(`save${Save.key}`, JSON.stringify({ ...saveObject, farming: farmingJson }));
        localStorage.setItem(`player${Save.key}`, JSON.stringify(player));
        App.game = new Game();
        App.game.initialize();
        farming = App.game.farming;
    };

    // From the save alone, as after importing it into another browser profile
    localStorage.removeItem(mirrorKey);
    reload(saveObject.farming);
    check('the stock of 5 comes back from the save, without the mirror', stock() === 5, stock());

    // The save wins over a mirror left by another session
    localStorage.setItem(mirrorKey, JSON.stringify({ stock: 40 }));
    reload(saveObject.farming);
    check('the save wins over the mirror', stock() === 5, stock());

    // A save without the key, as 1.0.0 wrote it or as the unmodified game rewrites it
    const { witherMulch: dropped, ...withoutStock } = saveObject.farming;
    localStorage.setItem(mirrorKey, JSON.stringify({ stock: 5 }));
    reload(withoutStock);
    check('a save without the stock takes it from the mirror', stock() === 5, stock());
    check('and writes it to the save from then on', farming.toJSON().witherMulch === 5);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
