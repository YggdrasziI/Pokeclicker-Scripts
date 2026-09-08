// Scenario for tools/realgame/start.mjs, with pokeclickerautomation: the Beast Ball, sold
// for quest points at Looker's Exchange (Roadside Motel), has its own auto-shop tab. Its
// row is hidden until that town is unlocked, is off by default, and buying goes through
// the quest point wallet up to the target amount. Works on a fresh save or with --save.
try {
    const out = [];
    let failed = false;
    const check = (l, c, d) => { out.push(`${c ? 'ok  ' : 'FAIL'} ${l}${d !== undefined ? ' -- ' + d : ''}`); if (!c) failed = true; };
    const shop = Automation.Shop;
    const storage = Automation.Utils.LocalStorage;
    const items = shop.__internal__shopItems;
    const beast = items.find((d) => d.item.name === 'Beastball');
    check('Beast Ball listed', beast !== undefined);
    check('sold for quest points', beast?.item.currency === GameConstants.Currency.questPoint);
    check('only one Master Ball entry, in Pokédollars', items.filter((d) => d.item.name === 'Masterball').length === 1 && items.find((d) => d.item.name === 'Masterball').item.currency === GameConstants.Currency.money);
    check('no other non-Pokédollar ball', items.every((d) => !Automation.Utils.isInstanceOf(d.item, 'PokeballItem') || d.item.currency === GameConstants.Currency.money || d.item.name === 'Beastball'));
    const tabLabels = [...document.querySelectorAll('[id^="automation-tab-automationShopSettings-"][id$="-label"]')].map((e) => e.textContent.trim());
    check('a Beast Balls tab exists', tabLabels.includes('Beast Balls'), tabLabels.join(' | '));
    const beastRow = beast?.htmlElems.row;
    const labels = [...document.querySelectorAll('[id^="automation-tab-automationShopSettings-"][id$="-label"]')];
    const tabOf = (row) => { const c = row.closest('.automationTabContent'); return labels[[...c.parentElement.children].indexOf(c)]?.textContent.trim(); };
    check('the row sits in the Beast Balls tab', tabOf(beastRow) === 'Beast Balls', tabOf(beastRow));
    const eggRows = items.filter((d) => d.item.currency === GameConstants.Currency.questPoint && !Automation.Utils.isInstanceOf(d.item, 'PokeballItem') && !Automation.Utils.isInstanceOf(d.item, 'EvolutionStone'));
    check('eggs are in the Eggs tab, not with the ball', eggRows.every((d) => tabOf(d.htmlElems.row) === 'Eggs'), [...new Set(eggRows.map((d) => tabOf(d.htmlElems.row)))].join(','));
    check('item disabled by default', storage.getValue('Shop-Beastball-Enabled') === 'false');
    check('defaults: buy 10 until 100', storage.getValue('Shop-Beastball-BuyAmount') === '10' && storage.getValue('Shop-Beastball-TargetAmount') === '100');
    const motelUnlocked = TownList['Roadside Motel'].isUnlocked();
    check('row hidden iff Roadside Motel locked', beastRow.hidden === !motelUnlocked, `motel unlocked ${motelUnlocked}, hidden ${beastRow.hidden}`);
    check('quantity read from the ball inventory', shop.__internal__getItemQuantity(beast.item) === App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball));

    // Buy path: pretend the motel is reachable, enable the item, give quest points
    TownList['Roadside Motel'].isUnlocked = () => true;
    const canMove = Automation.Utils.Route.canMoveToRegion;
    Automation.Utils.Route.canMoveToRegion = () => true;
    check('purchasable once the shop is reachable', beast.isPurchasable());
    storage.setValue('Shop-Beastball-Enabled', true);
    storage.setValue('Shop-Beastball-TargetAmount', App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball) + 15);
    storage.setValue('Shop-questPoint-MinPlayerCurrency', 0);
    App.game.wallet.gainQuestPoints(1000000);
    const before = App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball);
    const qpBefore = App.game.wallet.currencies[GameConstants.Currency.questPoint]();
    shop.__internal__shop();
    check('bought 10 Beast Balls', App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball) === before + 10, `${before} -> ${App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball)}`);
    check('paid in quest points', App.game.wallet.currencies[GameConstants.Currency.questPoint]() < qpBefore, `${qpBefore} -> ${App.game.wallet.currencies[GameConstants.Currency.questPoint]()}`);
    // The price rose with the purchase, above the default max unit price: the shop waits
    shop.__internal__shop();
    check('waits while the unit price is above the max', App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball) === before + 10, 'unit ' + beast.item.totalPrice(1) + ' max ' + storage.getValue('Shop-Beastball-MaxBuyUnitPrice'));
    storage.setValue('Shop-Beastball-MaxBuyUnitPrice', 100000);
    shop.__internal__shop();
    check('second pass stops at the target', App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball) === before + 15, 'qty ' + App.game.pokeballs.getBallQuantity(GameConstants.Pokeball.Beastball) + ' target ' + storage.getValue('Shop-Beastball-TargetAmount') + ' price ' + beast.item.totalPrice(5) + ' qp ' + App.game.wallet.currencies[GameConstants.Currency.questPoint]() + ' minQP ' + storage.getValue('Shop-questPoint-MinPlayerCurrency') + ' maxUnit ' + storage.getValue('Shop-Beastball-MaxBuyUnitPrice') + ' unit ' + beast.item.totalPrice(1));
    Automation.Utils.Route.canMoveToRegion = canMove;
    console.log(out.join('\n'));
    window.__scenario = !failed;
} catch (e) { console.log('ERR ' + e.stack); window.__scenario = false; }
