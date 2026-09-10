// Scenario for tools/realgame/start.mjs, with pokeclickerautomation: the Key Stone, sold
// for battle points at Shalour City and A Tree Maybe, has its own auto-shop tab. Its row
// is hidden until one of those towns is unlocked, is off by default, and buying goes
// through the battle point wallet up to the target amount. The other battle point items
// (the Battle Frontier energy restores) get no tab. Works on a fresh save or with --save.
try {
    const out = [];
    let failed = false;
    const check = (l, c, d) => { out.push(`${c ? 'ok  ' : 'FAIL'} ${l}${d !== undefined ? ' -- ' + d : ''}`); if (!c) failed = true; };
    const shop = Automation.Shop;
    const storage = Automation.Utils.LocalStorage;
    const items = shop.__internal__shopItems;
    const bp = GameConstants.Currency.battlePoint;
    const key = items.find((d) => d.item.name === 'Key_stone');
    check('Key Stone listed', key !== undefined);
    check('sold for battle points', key?.item.currency === bp);
    check('the Peat Block (diamonds) stays out', items.every((d) => d.item.name !== 'Peat_block'));
    const tabLabels = [...document.querySelectorAll('[id^="automation-tab-automationShopSettings-"][id$="-label"]')].map((e) => e.textContent.trim());
    check('a Key Stones tab exists', tabLabels.includes('Key Stones'), tabLabels.join(' | '));
    const keyRow = key?.htmlElems.row;
    const labels = [...document.querySelectorAll('[id^="automation-tab-automationShopSettings-"][id$="-label"]')];
    const tabOf = (row) => { const c = row?.closest('.automationTabContent'); return c ? labels[[...c.parentElement.children].indexOf(c)]?.textContent.trim() : undefined; };
    check('the row sits in the Key Stones tab', tabOf(keyRow) === 'Key Stones', tabOf(keyRow));
    const keyTab = keyRow.closest('.automationTabContent');
    check('it is the only row of that tab', keyTab.querySelectorAll('tr').length === 1, keyTab.querySelectorAll('tr').length);
    const otherBp = items.filter((d) => d.item.currency === bp && d.item.name !== 'Key_stone');
    check('other battle point items have no row', otherBp.every((d) => d.htmlElems.row === undefined), otherBp.map((d) => d.item.name).join(','));
    const thresholdImg = keyTab.querySelector('img[src$="battlePoint.svg"]');
    check('the tab threshold shows the battle point currency', thresholdImg !== null);
    check('quest point stones still in the Evolution items tab', items.filter((d) => Automation.Utils.isInstanceOf(d.item, 'EvolutionStone') && d.item.currency === GameConstants.Currency.questPoint).every((d) => tabOf(d.htmlElems.row) === 'Evolution items'));
    check('item disabled by default', storage.getValue('Shop-Key_stone-Enabled') === 'false');
    check('defaults: buy 1 until 1', storage.getValue('Shop-Key_stone-BuyAmount') === '1' && storage.getValue('Shop-Key_stone-TargetAmount') === '1');
    check('default battle point threshold 1000', storage.getValue(`Shop-${bp}-MinPlayerCurrency`) === '1000');
    const unlocked = TownList['Shalour City'].isUnlocked() || TownList['A Tree Maybe'].isUnlocked();
    check('row hidden iff both shops locked', keyRow.hidden === !unlocked, `unlocked ${unlocked}, hidden ${keyRow.hidden}`);
    check('quantity read from the item list', shop.__internal__getItemQuantity(key.item) === player.itemList.Key_stone());

    // Buy path: pretend Shalour City is reachable, enable the item, give battle points
    TownList['Shalour City'].isUnlocked = () => true;
    const canMove = Automation.Utils.Route.canMoveToRegion;
    Automation.Utils.Route.canMoveToRegion = () => true;
    check('purchasable once the shop is reachable', key.isPurchasable());
    storage.setValue('Shop-Key_stone-Enabled', true);
    const before = player.itemList.Key_stone();
    storage.setValue('Shop-Key_stone-TargetAmount', before + 2);
    storage.setValue(`Shop-${bp}-MinPlayerCurrency`, 0);
    App.game.wallet.gainBattlePoints(1000000, true);
    const bpBefore = App.game.wallet.currencies[bp]();
    const unitBefore = key.item.totalPrice(1);
    shop.__internal__shop();
    check('bought 1 Key Stone', player.itemList.Key_stone() === before + 1, `${before} -> ${player.itemList.Key_stone()}`);
    check('paid in battle points', App.game.wallet.currencies[bp]() === bpBefore - unitBefore, `${bpBefore} -> ${App.game.wallet.currencies[bp]()}, unit ${unitBefore}`);
    check('the price rose with the purchase', key.item.totalPrice(1) > unitBefore, `${unitBefore} -> ${key.item.totalPrice(1)}`);
    shop.__internal__shop();
    check('second pass reaches the target', player.itemList.Key_stone() === before + 2, player.itemList.Key_stone());
    shop.__internal__shop();
    check('then stops at the target', player.itemList.Key_stone() === before + 2, player.itemList.Key_stone());
    // The threshold holds the purchase back
    storage.setValue('Shop-Key_stone-TargetAmount', before + 3);
    storage.setValue(`Shop-${bp}-MinPlayerCurrency`, App.game.wallet.currencies[bp]());
    shop.__internal__shop();
    check('the battle point threshold holds', player.itemList.Key_stone() === before + 2, player.itemList.Key_stone());
    Automation.Utils.Route.canMoveToRegion = canMove;
    console.log(out.join('\n'));
    window.__scenario = !failed;
} catch (e) { console.log('ERR ' + e.stack); window.__scenario = false; }
