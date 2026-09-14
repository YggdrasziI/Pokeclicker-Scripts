// Scenario for tools/realgame/start.mjs, with oakitemsunlimited: every Oak Item slot is
// unlocked from the start, and the equipped Oak Items module lays its rows out two per
// line, hiding the rows of the unequipped items, with the game's shortened numbers in
// the progress bars.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    const item = (key) => App.game.oakItems.itemList[OakItemType[key]];
    const oakItems = App.game.oakItems;

    // Slots
    check('every slot is unlocked', oakItems.maxActiveCount() === oakItems.itemList.length && oakItems.unlockRequirements.every((requirement) => requirement === 0));
    check('the modal header counts every item', document.querySelector('#oakItemsModal h5').textContent === `Oak Items Equipped: 0/${oakItems.itemList.length}`);

    // The runner starts the game without its bindings: bind the module alone, the way
    // the game binds the page, and flush Knockout's deferred updates after each change
    ko.applyBindings(App.game, document.getElementById('oakItemsContainer'));
    const flush = () => ko.tasks.runEarly();
    flush();

    // Layout: the two-column rules are installed, the unequipped rows are emptied
    const rules = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    check('the module rows are laid out two per line', rules.includes('#oakItemsBody > table > tbody { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }'));
    check('an emptied row takes no cell', rules.includes('#oakItemsBody > table > tbody > tr:empty { display: none; }'));
    check('the icon cell keeps its own width, not the table\'s 1 pixel', rules.includes('td.tight { flex: 0 0 auto; width: auto; }'));
    const rows = () => [...document.querySelectorAll('#oakItemsBody > table > tbody > tr')];
    check('one row per Oak Item, all emptied while nothing is equipped', rows().length === oakItems.itemList.length && rows().every((row) => row.childNodes.length === 0));

    // Shortened numbers: the Amulet Coin at level 4 needs 5,000 more experience and
    // its last level costs 1,000,000 Pokédollars
    const coin = item('Amulet_Coin');
    coin.fromJSON({ level: 4, exp: 5000, isActive: true });
    flush();
    const coinRow = rows()[OakItemType.Amulet_Coin];
    const progressText = () => coinRow.querySelector('.progress span')?.textContent.trim();
    check('an equipped item fills its row', coinRow.childNodes.length > 0 && coinRow.querySelector('img')?.getAttribute('src') === 'assets/images/oakitems/Amulet_Coin.png');
    check('the progress reads 0 / 5K', progressText() === '0 / 5K', progressText());
    coin.gainExp(2500);
    flush();
    check('the progress follows the experience, 2.5K / 5K', progressText() === '2.5K / 5K', progressText());
    coin.gainExp(2500);
    flush();
    const upgrade = coinRow.querySelector('.progress span.clickable');
    check('the upgrade reads 1M with the currency icon', upgrade?.textContent.trim() === 'Upgrade (1M )' && upgrade.querySelector('img')?.getAttribute('src') === 'assets/images/currency/money.svg', upgrade?.innerHTML);
    App.game.wallet.gainMoney(1000000, true);
    upgrade.click();
    flush();
    check('the upgrade still buys the level', coin.level === 5 && progressText() === 'MAX LEVEL!', progressText());
    coin.fromJSON({ level: 0, exp: 0, isActive: false });
    flush();
    check('an unequipped item empties its row again', coinRow.childNodes.length === 0);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
