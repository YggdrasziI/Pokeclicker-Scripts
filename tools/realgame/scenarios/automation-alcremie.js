// Scenario for tools/realgame/start.mjs, with pokeclickerautomation and simpletimechanger:
// check the 'Alcremie forms' focus topic against the real game. On a fresh save it must stay
// hidden until Milcery is caught, report the berries it cannot farm, ask the farm for the
// closest sweet, spin once affordable, change the hour for the dusk form (or report it has
// to wait without the hour selector), go for Milcery (Cheesy) last and restore the hour.
// Asynchronous: the first spin resolves after one second.
(async () => {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };
    try {
        const focus = Automation.Focus;
        const alcremie = focus.BattleCafe;
        const C = BattleCafeController;
        const inventory = App.game.farming.berryInventory;
        const topic = focus.__internal__functionalities.find((f) => f.id === 'Alcremie');
        const strawberry = GameConstants.AlcremieSweet['Strawberry Sweet'];
        const forms = C.evolutions[strawberry];
        const caught = (name) => App.game.party.alreadyCaughtPokemonByName(name);
        const tick = () => alcremie.__internal__focusOnAlcremie();

        // Every report is recorded instead of switching topics
        const reports = [];
        focus.__reportBlocked = (reason) => reports.push(reason);
        const lastReport = () => reports[reports.length - 1];

        // Drop-down entry, after Roamers and before the gems
        const ids = focus.__internal__functionalities.map((f) => f.id);
        check('topic listed right after Roamers', topic !== undefined && ids.indexOf('Alcremie') === ids.indexOf('Roamers') + 1);
        check('option built', document.getElementById('Alcremie')?.value === 'Alcremie');
        check('locked without Milcery', topic.isUnlocked() === false);
        App.game.party.gainPokemonByName('Milcery', false, true);
        check('unlocked once Milcery is caught', topic.isUnlocked() === true);
        check('the spin duration input exists without opening the café', document.getElementById('battleCafeDuration') !== null);

        const timeSelect = document.getElementById('change-time-select');
        check('the hour selector is there', timeSelect !== null);
        timeSelect.value = '12';
        timeSelect.dispatchEvent(new Event('change'));
        check('forced to day', DayCycle.currentDayCyclePart() === AutomationBattleCafe.__DayCyclePart.Day);
        C.spinsLeft(10);

        // No berry at all: nothing can be farmed
        tick();
        check('reports the berries it has none of', /none of: .*Cheri/.test(lastReport() ?? ''), lastReport());
        check('the farm is not asked for anything', Automation.Farm.ForcePlantBerriesAsked === null);

        // A few of each strawberry sweet berry: the farm is asked for the worst one
        reports.length = 0;
        C.getPrice(strawberry).forEach((b) => inventory[b.berry](10));
        tick();
        check('no report while there is something to farm', reports.length === 0, reports.join(' | '));
        check('the farm is asked for Cheri', Automation.Farm.ForcePlantBerriesAsked === BerryType.Cheri, Automation.Farm.ForcePlantBerriesAsked);

        // Affordable: spins for the first day form, and gives the farm back
        C.getPrice(strawberry).forEach((b) => inventory[b.berry](b.amount * 20));
        tick();
        check('a spin started', C.isSpinning() === true);
        check('the strawberry sweet is used', C.selectedSweet() === strawberry);
        check('for one second', document.getElementById('battleCafeDuration').value === '1');
        check('the farm is released', Automation.Farm.ForcePlantBerriesAsked === null);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        check('the spin resolved', C.isSpinning() === false);
        const vanilla = forms[GameConstants.AlcremieSpins.dayClockwiseBelow5].name;
        check(`${vanilla} caught`, caught(vanilla));

        // Only the rainbow form left: it needs dusk
        for (const [spin, reward] of Object.entries(forms)) {
            if (+spin !== GameConstants.AlcremieSpins.at5Above10) {
                App.game.party.gainPokemonByName(reward.name, false, true);
            }
        }

        // Without the hour selector, it has to wait for the real dusk
        const anchor = timeSelect.nextSibling;
        const parent = timeSelect.parentNode;
        timeSelect.remove();
        reports.length = 0;
        tick();
        check('without the selector, it reports having to wait', /another time of day/.test(lastReport() ?? ''), lastReport());
        check('and does not spin', C.isSpinning() === false);
        parent.insertBefore(timeSelect, anchor);

        // With it, the hour goes to 17:00 and the rainbow spin starts
        reports.length = 0;
        tick();
        check('the hour is changed to dusk', timeSelect.value === '17' && DayCycle.currentDayCyclePart() === AutomationBattleCafe.__DayCyclePart.Dusk,
            `${timeSelect.value} / ${DayCycle.currentDayCyclePart()}`);
        check('a counter-clockwise 11 second spin started',
            C.isSpinning() === true && document.getElementById('battleCafeDuration').value === '11' && C.clockwise() === false);
        check('no report', reports.length === 0, reports.join(' | '));
        C.isSpinning(false);

        // Every strawberry form caught: Milcery (Cheesy) comes last, with an hour long spin
        App.game.party.gainPokemonByName(forms[GameConstants.AlcremieSpins.at5Above10].name, false, true);
        tick();
        check('the Cheesy spin started', C.isSpinning() === true && document.getElementById('battleCafeDuration').value === '3600');
        C.isSpinning(false);

        App.game.party.gainPokemonByName('Milcery (Cheesy)', false, true);
        tick();
        check('then only the unfarmable sweets are left', /none of:/.test(lastReport() ?? ''), lastReport());

        // Stopping gives the hour back
        topic.stop();
        check('the hour is restored', timeSelect.value === '12', timeSelect.value);
        check('Auto Spin is available again', document.getElementById(AutomationBattleCafe.Settings.FeatureEnabled).disabled === false);
    } catch (error) {
        out.push(`SCENARIO FAILED: ${error.stack || error}`);
        window.__scenarioFailed = true;
    }
    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
})();
