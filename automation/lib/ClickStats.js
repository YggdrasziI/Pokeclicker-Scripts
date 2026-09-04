/**
 * @class The AutomationClickStats reports how well the auto attack is actually doing.
 *
 * Ported from Ephenia's Enhanced Auto Clicker, which is the only one of the two projects to
 * measure anything. Knowing the clicker is only managing half the ticks you asked for, or that
 * the current route needs three times your click damage to one-shot, is the difference between
 * tuning the interval and guessing at it.
 *
 * Everything is averaged over the last ten seconds, and reset whenever the player moves, since
 * a new area invalidates the comparison.
 */
class AutomationClickStats
{
    static Settings = {
                          EfficiencyDisplayMode: "Click-EfficiencyDisplayMode",
                          DamageDisplayMode: "Click-DamageDisplayMode"
                      };

    /**
     * @brief Builds the display and starts measuring
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.EfficiencyDisplayMode, 0);
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.DamageDisplayMode, 0);

            this.__internal__buildMenu();
        }
        else
        {
            this.__internal__countTicks();
            this.__internal__resetTracker();
            setInterval(this.__internal__refresh.bind(this), 1000);
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__display = null;
    static __internal__tracker = {
                                     lastUpdate: null,
                                     playerState: -1,
                                     playerLocation: null,
                                     ticks: null,
                                     clicks: null,
                                     enemies: null,
                                     areaHealth: 0
                                 };

    /**
     * @brief Adds the readout under the 'Auto attack' row, plus the two display mode pickers
     */
    static __internal__buildMenu()
    {
        const container = Automation.Click.__internal__container;
        if (!container)
        {
            // The auto attack feature was not built (challenge mode), nothing to measure
            return;
        }

        this.__internal__display = document.createElement("div");
        this.__internal__display.id = "automationClickStats";
        container.appendChild(this.__internal__display);

        // The pickers belong with the rest of the auto attack settings
        const settingPanel = container.querySelector(".automation-setting-inline-panel");
        if (settingPanel)
        {
            this.__internal__addDisplayModePicker(
                settingPanel, "Efficiency shown as:", this.Settings.EfficiencyDisplayMode,
                [ "Percentage", "Ticks/s" ]);
            this.__internal__addDisplayModePicker(
                settingPanel, "Damage shown as:", this.Settings.DamageDisplayMode,
                [ "Click attacks", "Damage" ]);
        }

        this.__internal__renderPlaceholders();
    }

    /**
     * @brief Adds a labeled two-option picker bound to the @p setting
     */
    static __internal__addDisplayModePicker(parent, label, setting, options)
    {
        const container = document.createElement("div");
        container.style.textAlign = "right";
        container.style.marginTop = "5px";
        parent.appendChild(container);

        container.appendChild(document.createTextNode(label));

        const selectElem = Automation.Menu.createDropDownListElement(`select-${setting}`);
        selectElem.style.position = "relative";
        selectElem.style.bottom = "2px";
        selectElem.style.width = "120px";
        selectElem.style.marginLeft = "4px";
        selectElem.style.paddingLeft = "3px";
        container.appendChild(selectElem);

        const saved = parseInt(Automation.Utils.LocalStorage.getValue(setting), 10);
        options.forEach((text, value) =>
            {
                const opt = document.createElement("option");
                opt.textContent = text;
                opt.value = value;
                opt.selected = (value === saved);
                selectElem.options.add(opt);
            });

        selectElem.onchange = function()
            {
                Automation.Utils.LocalStorage.setValue(setting, selectElem.value);
                AutomationClickStats.__internal__resetTracker();
            };
    }

    /**
     * @brief Draws the four readouts, with no value yet
     */
    static __internal__renderPlaceholders()
    {
        const efficiencyAsTicks = (Automation.Utils.LocalStorage.getValue(this.Settings.EfficiencyDisplayMode) === "1");
        const damageAsDPS = (Automation.Utils.LocalStorage.getValue(this.Settings.DamageDisplayMode) === "1");

        this.__internal__display.innerHTML =
            `<div class="automation-click-stat"><span>${efficiencyAsTicks ? "Ticks/s" : "Efficiency"}</span>`
          + `<span id="automation-click-efficiency">-</span></div>`
          + `<div class="automation-click-stat"><span>${damageAsDPS ? "DPS" : "Click attacks/s"}</span>`
          + `<span id="automation-click-rate">-</span></div>`
          + `<div class="automation-click-stat"><span>Req. ${damageAsDPS ? "click damage" : "clicks"}</span>`
          + `<span id="automation-click-required">-</span></div>`
          + `<div class="automation-click-stat"><span>Enemies/s</span>`
          + `<span id="automation-click-enemies">-</span></div>`;
    }

    /**
     * @brief Counts every attack the auto clicker performs, to measure how many of the requested
     *        ticks actually happen
     */
    static __internal__countTicks()
    {
        const originalClick = Automation.Click.__internal__autoClick.bind(Automation.Click);
        Automation.Click.__internal__autoClick = function(...args)
            {
                if (AutomationClickStats.__internal__tracker.ticks)
                {
                    AutomationClickStats.__internal__tracker.ticks[0]++;
                }
                return originalClick(...args);
            };
    }

    /**
     * @brief Clears the measurements and starts a fresh window
     */
    static __internal__resetTracker()
    {
        this.__internal__tracker.lastUpdate = [ Date.now() ];
        this.__internal__tracker.ticks = [ 0 ];
        this.__internal__tracker.clicks = [ App.game.statistics.clickAttacks() ];
        this.__internal__tracker.enemies = [ App.game.statistics.totalPokemonDefeated() ];
        this.__internal__computeAreaHealth();

        if (this.__internal__display)
        {
            this.__internal__renderPlaceholders();
        }
    }

    /**
     * @brief Recomputes the four readouts
     */
    static __internal__refresh()
    {
        if (!this.__internal__display)
        {
            return;
        }

        if (this.__internal__hasPlayerMoved())
        {
            // A new area makes the previous measurements meaningless
            this.__internal__resetTracker();
            return;
        }

        const tracker = this.__internal__tracker;
        const elapsed = (Date.now() - tracker.lastUpdate.at(-1)) / (1000 * tracker.lastUpdate.length);
        if (elapsed <= 0)
        {
            return;
        }

        const clickDamage = App.game.party.calculateClickAttack(true);
        const efficiencyAsTicks = (Automation.Utils.LocalStorage.getValue(this.Settings.EfficiencyDisplayMode) === "1");
        const damageAsDPS = (Automation.Utils.LocalStorage.getValue(this.Settings.DamageDisplayMode) === "1");

        // How many of the requested ticks actually ran
        const avgTicks = (tracker.ticks.reduce((a, b) => a + b, 0) / tracker.ticks.length) / elapsed;
        const clickInterval = Automation.Utils.tryParseInt(
            Automation.Utils.LocalStorage.getValue(Automation.Click.Settings.ClickInterval), 50);
        const maxTicksPerSecond = 1000 / clickInterval;
        this.__internal__setStat("automation-click-efficiency",
                                 efficiencyAsTicks
                                     ? avgTicks.toLocaleString("en-US", { maximumFractionDigits: 1 })
                                     : (avgTicks / maxTicksPerSecond).toLocaleString(
                                           "en-US", { style: "percent", maximumFractionDigits: 0 }));

        // Click attacks landed per second, or the damage they represent
        const avgClicks = ((App.game.statistics.clickAttacks() - tracker.clicks.at(-1)) / tracker.clicks.length) / elapsed;
        this.__internal__setStat("automation-click-rate",
                                 damageAsDPS
                                     ? (avgClicks * clickDamage).toLocaleString("en-US", { maximumFractionDigits: 0 })
                                     : avgClicks.toLocaleString("en-US", { maximumFractionDigits: 1 }));

        // What it would take to one-shot here. Dungeon bosses and chest health are ignored.
        if (tracker.areaHealth === 0)
        {
            this.__internal__setStat("automation-click-required", "-", false);
        }
        else if (damageAsDPS)
        {
            this.__internal__setStat("automation-click-required",
                                     Math.ceil(tracker.areaHealth).toLocaleString("en-US"));
        }
        else
        {
            this.__internal__setStat("automation-click-required",
                                     Math.ceil(tracker.areaHealth / clickDamage).toLocaleString("en-US"));
        }

        const avgEnemies = ((App.game.statistics.totalPokemonDefeated() - tracker.enemies.at(-1))
                            / tracker.enemies.length) / elapsed;
        this.__internal__setStat("automation-click-enemies",
                                 avgEnemies.toLocaleString("en-US", { maximumFractionDigits: 1 }));

        // Open the next second's window. Newest entry first, so the click counter can just
        // increment index 0.
        const push = (list, value) =>
            {
                list.unshift(value);
                if (list.length > 10)
                {
                    list.pop();
                }
            };
        push(tracker.ticks, 0);
        push(tracker.clicks, App.game.statistics.clickAttacks());
        push(tracker.enemies, App.game.statistics.totalPokemonDefeated());
        push(tracker.lastUpdate, Date.now());
    }

    static __internal__setStat(id, value, highlight = true)
    {
        const elem = document.getElementById(id);
        if (!elem)
        {
            return;
        }
        elem.textContent = value;
        if (highlight)
        {
            elem.style.color = "gold";
        }
        else
        {
            elem.style.removeProperty("color");
        }
    }

    /**
     * @brief Works out the health a single enemy has here, to answer 'how much damage do I need'
     */
    static __internal__computeAreaHealth()
    {
        const tracker = this.__internal__tracker;

        if (App.game.gameState === GameConstants.GameState.fighting)
        {
            const routeHealth = PokemonFactory.routeHealth(player.route, player.region);
            // Routes vary their health by pokemon, mirror what PokemonFactory.generateWildPokemon does
            const pokeHP = [ ...new Set(Object.values(Routes.getRoute(player.region, player.route).pokemon)
                                              .flat().flatMap((p) => p.pokemon ?? p)) ]
                           .map((p) => pokemonMap[p].base.hitpoints);
            const averageHP = pokeHP.reduce((s, a) => s + a, 0) / pokeHP.length;
            const highestHP = pokeHP.reduce((m, a) => Math.max(m, a), 0);
            tracker.areaHealth = Math.round(routeHealth * (0.9 + (highestHP / averageHP) / 10));
        }
        else if (App.game.gameState === GameConstants.GameState.gym)
        {
            tracker.areaHealth = GymRunner.gymObservable().getPokemonList().reduce((a, b) => Math.max(a, b.maxHealth), 0);
        }
        else if (App.game.gameState === GameConstants.GameState.dungeon)
        {
            tracker.areaHealth = DungeonRunner.dungeon.baseHealth;
        }
        else if (App.game.gameState === GameConstants.GameState.temporaryBattle)
        {
            tracker.areaHealth = TemporaryBattleRunner.battleObservable().getPokemonList()
                                     .reduce((a, b) => Math.max(a, b.maxHealth), 0);
        }
        else
        {
            // Nothing meaningful to compare against outside of a fight
            tracker.areaHealth = 0;
        }
    }

    /**
     * @brief Tells whether the player changed area or game state since the last check
     */
    static __internal__hasPlayerMoved()
    {
        const tracker = this.__internal__tracker;
        let moved = false;

        const newState = App.game.gameState;
        if (tracker.playerState !== newState)
        {
            tracker.playerState = newState;
            moved = true;
        }

        let newLocation;
        if (App.game.gameState === GameConstants.GameState.gym)
        {
            newLocation = GymRunner.gymObservable().leaderName;
        }
        else if (App.game.gameState === GameConstants.GameState.dungeon)
        {
            newLocation = DungeonRunner.dungeon.name;
        }
        else if (App.game.gameState === GameConstants.GameState.temporaryBattle)
        {
            newLocation = TemporaryBattleRunner.battleObservable().name;
        }
        else
        {
            // player.route is 0 when the player is not on a route
            newLocation = player.route || player.town?.name;
        }

        if (tracker.playerLocation !== newLocation)
        {
            tracker.playerLocation = newLocation;
            moved = true;
        }

        return moved;
    }
}
