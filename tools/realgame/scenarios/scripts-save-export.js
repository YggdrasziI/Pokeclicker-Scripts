// Scenario for tools/realgame/start.mjs, with oakcharms, oakitemsoverload and withermulch:
// builds a save holding what the three scripts add to it (a charm at level 7, a game item
// overloaded to level 8, a Wither Mulch stock) next to ordinary farm progress, and prints
// it as the base64 the game exports, on lines starting with SAVE-EXPORT:. Joined into a
// file, it is the input of vanilla-after-scripts.js, which loads it without any script:
//
//   node tools/realgame/start.mjs oakcharms oakitemsoverload withermulch \
//       --scenario=tools/realgame/scenarios/scripts-save-export.js | sed -n 's/^.*SAVE-EXPORT://p' | tr -d '\r\n' > save.txt
//   node tools/realgame/start.mjs --save=save.txt --scenario=tools/realgame/scenarios/vanilla-after-scripts.js
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

    item('Quest_Charm').fromJSON({ level: 7, exp: 30000, isActive: true, uses: 12 });
    const coin = item('Amulet_Coin');
    coin.fromJSON({ level: 8, exp: coin.expList[7], isActive: true });
    item('Magic_Ball').fromJSON({ level: 3, exp: item('Magic_Ball').expList[2], isActive: false });

    App.game.wallet.gainFarmPoints(100000, true);
    ItemList.Wither_Mulch.buy(3);
    const index = farming.plotList.findIndex((plot) => plot.isUnlocked);
    farming.plotList[index].plant(BerryType.Cheri);
    farming.shovelAmt(4);
    farming.mulchList[MulchType.Boost_Mulch](2);

    const save = Save.getSaveObject();
    check('the save holds the charm', save.oakItems.Quest_Charm?.level === 7 && save.oakItems.Quest_Charm.uses === 12);
    check('the save holds the overloaded level next to the game\'s maximum', save.oakItems.Amulet_Coin.level === 5 && save.oakItems.Amulet_Coin.overload?.level === 8, JSON.stringify(save.oakItems.Amulet_Coin));
    check('the save holds the mulch stock next to the game\'s list', save.farming.witherMulch === 3 && save.farming.mulchList.length === 7, JSON.stringify(save.farming.mulchList));

    console.log(out.join('\n'));
    // start.mjs cuts a page line at 10,000 characters: one line per chunk
    const exported = SaveSelector.btoa(JSON.stringify({ player, save, settings: Settings.toJSON() }));
    for (let start = 0; start < exported.length; start += 8000) {
        console.log(`SAVE-EXPORT:${exported.slice(start, start + 8000)}`);
    }
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
