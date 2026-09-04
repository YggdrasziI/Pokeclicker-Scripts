/**
 * @class The AutomationBattleCafe regroups the BattleCafe panel elements
 */
class AutomationBattleCafe
{
    static Settings = {
                          FeatureEnabled: "BattleCafe-SpinEnabled"
                      };

    /**
     * @brief Initializes the Battle Café components
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            // The feature button is created with forceDisabled, so it starts off on a fresh save
            // but keeps whatever the player chose afterwards, like every other automation feature
            this.__internal__buildMenu();
        }
        else if (initStep == Automation.InitSteps.Finalize)
        {
            // Set the div visibility and content watcher
            setInterval(this.__internal__updateDivVisibilityAndContent.bind(this), 1000); // Refresh every 1s

            // Restore previous session state
            this.__internal__toggleAutoSpin();
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__battleCafeInGameModal = null;
    static __internal__battleCafeSweetContainers = [];
    static __internal__currentlyVisibleSweet = null;
    static __internal__caughtPokemonIndicators = new Map();
    static __internal__pokemonPokerusIndicators = new Map();

    static __internal__autoSpinLoop = null;
    static __internal__farmRequestedBerry = null;

    // Mirrored from the game's src/modules/dayCycle/DayCyclePart.ts.
    // DayCycle itself is a global (the game's town map binds DayCycle.color), but the enum is only
    // ever referenced from typescript, so the values are restated here rather than assumed present
    static __internal__DayCyclePart = { Dawn: 0, Day: 1, Dusk: 2, Night: 3 };

    /**
     * @brief Builds the 'Battle Café' menu panel
     */
    static __internal__buildMenu()
    {
        // Store the in-game modal internally
        this.__internal__battleCafeInGameModal = document.getElementById("battleCafeModal");

        let battleCafeTitle = '☕ Battle Café ☕';
        const battleCafeContainer =
            Automation.Menu.addFloatingCategory("automationBattleCafe", battleCafeTitle, this.__internal__battleCafeInGameModal);

        // Update the style to fit the width according to the panel content
        const mainContainer = battleCafeContainer.parentElement;
        mainContainer.style.width = "unset";
        mainContainer.style.minWidth = "145px";

        const spinTooltip = "Spins for any Alcremie form you have not caught yet"
                          + Automation.Menu.TooltipSeparator
                          + "Only the forms reachable at the current time of day are\n"
                          + "attempted, so leaving it on eventually covers all of them\n"
                          + "When the berries a sweet needs are missing, the farm is\n"
                          + "asked to grow them, unless another feature already owns it"
                          + Automation.Menu.TooltipSeparator
                          + "⚠️ Spinning consumes berries, in the thousands for some sweets";
        const featureButton =
            Automation.Menu.addAutomationButton("Auto Spin", this.Settings.FeatureEnabled, spinTooltip, battleCafeContainer, true);
        featureButton.addEventListener("click", this.__internal__toggleAutoSpin.bind(this), false);

        this.__internal__addInfo(null, -1, battleCafeContainer);

        for (const sweetIndex in BattleCafeController.evolutions)
        {
            const sweetData = BattleCafeController.evolutions[sweetIndex];

            const currentSweetContainer = document.createElement("div");
            currentSweetContainer.hidden = true;
            currentSweetContainer.style.textAlign = "left";
            currentSweetContainer.style.marginLeft = "5px";
            this.__internal__battleCafeSweetContainers.push(currentSweetContainer);

            currentSweetContainer.appendChild(document.createElement("br"));
            currentSweetContainer.appendChild(document.createTextNode("Day (6:00 → 18:00)"));
            currentSweetContainer.appendChild(document.createElement("br"));
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.dayClockwiseBelow5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.dayClockwiseAbove5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.dayCounterclockwiseBelow5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.dayCounterclockwiseAbove5, currentSweetContainer);

            currentSweetContainer.appendChild(document.createElement("br"));
            currentSweetContainer.appendChild(document.createTextNode("Dusk (17:00 → 18:00)"));
            currentSweetContainer.appendChild(document.createElement("br"));
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.at5Above10, currentSweetContainer);

            currentSweetContainer.appendChild(document.createElement("br"));
            currentSweetContainer.appendChild(document.createTextNode("Night (18:00 → 6:00)"));
            currentSweetContainer.appendChild(document.createElement("br"));
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.nightClockwiseBelow5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.nightClockwiseAbove5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.nightCounterclockwiseBelow5, currentSweetContainer);
            this.__internal__addInfo(sweetData, GameConstants.AlcremieSpins.nightCounterclockwiseAbove5, currentSweetContainer);
            battleCafeContainer.appendChild(currentSweetContainer);
        }
    }

    /**
     * @brief Toggles the 'Auto Spin' feature
     *
     * If the feature was enabled and it's toggled to disabled, the loop will be stopped.
     * If the feature was disabled and it's toggled to enabled, the loop will be started.
     *
     * @param enable: [Optional] If a boolean is passed, it will be used to set the right state.
     *                Otherwise, the local storage value will be used
     */
    static __internal__toggleAutoSpin(enable)
    {
        if (enable !== true && enable !== false)
        {
            enable = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        }

        if (enable)
        {
            if (this.__internal__autoSpinLoop === null)
            {
                // A spin blocks for its whole duration, so there is no point in checking more often
                this.__internal__autoSpinLoop = setInterval(this.__internal__autoSpinLoopCallback.bind(this), 5000);
                this.__internal__autoSpinLoopCallback();
            }
        }
        else
        {
            clearInterval(this.__internal__autoSpinLoop);
            this.__internal__autoSpinLoop = null;

            // Never leave the farm planting berries nobody asked for anymore
            this.__internal__releaseFarmRequest();
        }
    }

    /**
     * @brief The 'Auto Spin' loop
     *
     * Picks a form that has not been caught yet and can be obtained at the current time of day,
     * then spins for it. If the sweet it needs cannot be afforded, the farm is asked to grow the
     * berry that is furthest from its target instead.
     */
    static __internal__autoSpinLoopCallback()
    {
        // The game's spin() reads the duration straight from this input, so nothing can be
        // triggered without it
        const durationInput = document.getElementById("battleCafeDuration");
        if (durationInput === null)
        {
            return;
        }

        // A spin is already running, its result is not in yet
        if (BattleCafeController.isSpinning())
        {
            return;
        }

        const target = this.__internal__getNextSpinTarget();

        if (target === null)
        {
            // Every form reachable right now has been caught
            this.__internal__releaseFarmRequest();
            return;
        }

        if (!BattleCafeController.canBuySweet(target.sweet)())
        {
            this.__internal__askFarmForMissingBerry(target.sweet);
            return;
        }

        // The berries are there, stop occupying the farm
        this.__internal__releaseFarmRequest();

        // Checked last: the daily spins run out long before the berries do, and giving up the farm
        // request while waiting for tomorrow is the right thing to do
        if (BattleCafeController.spinsLeft() < 1)
        {
            return;
        }

        BattleCafeController.selectedSweet(target.sweet);
        durationInput.value = target.duration;
        BattleCafeController.spin(target.clockwise);
    }

    /**
     * @brief Determines the next form to spin for
     *
     * Sweets the player can already afford are preferred. Among the others, the one closest to
     * being affordable is returned, so the farm request converges instead of oscillating.
     *
     * @returns An object holding the sweet, spin duration and direction, or null if there is
     *          nothing left to catch at the current time of day
     */
    static __internal__getNextSpinTarget()
    {
        const reachableSpins = this.__internal__getReachableSpins();

        let closestTarget = null;
        let closestDeficit = Number.MAX_SAFE_INTEGER;

        for (const sweetIndex in BattleCafeController.evolutions)
        {
            const sweetData = BattleCafeController.evolutions[sweetIndex];
            const sweet = parseInt(sweetIndex);

            const neededSpin = reachableSpins.find(
                (spinData) =>
                {
                    const reward = sweetData[spinData.spin];
                    return (reward !== undefined)
                        && (Automation.Utils.getPokemonCaughtStatus(pokemonMap[reward.name].id) === CaughtStatus.NotCaught);
                });

            if (neededSpin === undefined)
            {
                continue;
            }

            const candidate = { sweet, duration: neededSpin.duration, clockwise: neededSpin.clockwise };

            if (BattleCafeController.canBuySweet(sweet)())
            {
                return candidate;
            }

            const deficit = this.__internal__getBerryDeficit(sweet);
            if (deficit < closestDeficit)
            {
                closestDeficit = deficit;
                closestTarget = candidate;
            }
        }

        return closestTarget;
    }

    /**
     * @brief Lists the spins that can be performed at the current time of day, shortest first
     *
     * Mirrors the game's BattleCafeController.unlockAlcremie: only Dusk with a counter-clockwise
     * spin longer than 10 seconds gives the rainbow form, and every other Dusk spin is resolved
     * as a day one. The 3600 second spin for Milcery (Cheesy) is left out on purpose, an hour of
     * real time is not something to start behind the player's back.
     *
     * @returns An array of { spin, duration, clockwise }, shortest spin first
     */
    static __internal__getReachableSpins()
    {
        const dayCyclePart = DayCycle.currentDayCyclePart();

        if ((dayCyclePart === this.__internal__DayCyclePart.Night)
            || (dayCyclePart === this.__internal__DayCyclePart.Dawn))
        {
            return [
                       { spin: GameConstants.AlcremieSpins.nightClockwiseBelow5, duration: 1, clockwise: true },
                       { spin: GameConstants.AlcremieSpins.nightCounterclockwiseBelow5, duration: 1, clockwise: false },
                       { spin: GameConstants.AlcremieSpins.nightClockwiseAbove5, duration: 5, clockwise: true },
                       { spin: GameConstants.AlcremieSpins.nightCounterclockwiseAbove5, duration: 5, clockwise: false }
                   ];
        }

        const daySpins = [
                             { spin: GameConstants.AlcremieSpins.dayClockwiseBelow5, duration: 1, clockwise: true },
                             { spin: GameConstants.AlcremieSpins.dayCounterclockwiseBelow5, duration: 1, clockwise: false },
                             { spin: GameConstants.AlcremieSpins.dayClockwiseAbove5, duration: 5, clockwise: true },
                             { spin: GameConstants.AlcremieSpins.dayCounterclockwiseAbove5, duration: 5, clockwise: false }
                         ];

        if (dayCyclePart === this.__internal__DayCyclePart.Dusk)
        {
            // The rainbow form is the only one that needs Dusk, so it is worth the longer spin
            daySpins.push({ spin: GameConstants.AlcremieSpins.at5Above10, duration: 11, clockwise: false });
        }

        return daySpins;
    }

    /**
     * @brief Computes how many berries are still missing to afford the given @p sweet
     *
     * @param sweet: The sweet to check
     *
     * @returns The total number of missing berries, all types combined
     */
    static __internal__getBerryDeficit(sweet)
    {
        return BattleCafeController.getPrice(sweet).reduce(
            (total, cost) => total + Math.max(0, cost.amount - App.game.farming.berryInventory[cost.berry]()), 0);
    }

    /**
     * @brief Asks the farming automation to grow the berry the given @p sweet is furthest from
     *
     * Automation.Farm.ForcePlantBerriesAsked is a single-slot channel, and the quests focus writes
     * to it as well. The quests focus wins: this only ever claims the channel while it is free, and
     * steps aside as soon as someone else has taken it.
     *
     * @param sweet: The sweet to gather the berries of
     */
    static __internal__askFarmForMissingBerry(sweet)
    {
        let missingBerry = null;
        let worstDeficit = 0;

        for (const cost of BattleCafeController.getPrice(sweet))
        {
            const deficit = cost.amount - App.game.farming.berryInventory[cost.berry]();
            if (deficit > worstDeficit)
            {
                worstDeficit = deficit;
                missingBerry = cost.berry;
            }
        }

        if (missingBerry === null)
        {
            return;
        }

        // Someone else owns the farm, drop any claim and wait for it to be free again
        if ((Automation.Farm.ForcePlantBerriesAsked !== null)
            && (Automation.Farm.ForcePlantBerriesAsked !== this.__internal__farmRequestedBerry))
        {
            this.__internal__farmRequestedBerry = null;
            return;
        }

        if (Automation.Farm.ForcePlantBerriesAsked === missingBerry)
        {
            return;
        }

        Automation.Farm.ForcePlantBerriesAsked = missingBerry;
        this.__internal__farmRequestedBerry = missingBerry;

        Automation.Notifications.sendNotif(
            `Asked the farm for ${BerryType[missingBerry]} berries (${worstDeficit.toLocaleString('en-US')} missing)`,
            "BattleCafe");
    }

    /**
     * @brief Gives the farm back, if this feature is the one currently holding it
     */
    static __internal__releaseFarmRequest()
    {
        if ((this.__internal__farmRequestedBerry !== null)
            && (Automation.Farm.ForcePlantBerriesAsked === this.__internal__farmRequestedBerry))
        {
            Automation.Farm.ForcePlantBerriesAsked = null;
        }

        this.__internal__farmRequestedBerry = null;
    }

    /**
     * @brief Adds the given @p spinType info to the panel
     *
     * @param sweetData: The battle café sweet data
     * @param spinType: The spin type
     * @param {Element} parent: The parent div
     */
    static __internal__addInfo(sweetData, spinType, parent)
    {
        let container = document.createElement("div");
        parent.appendChild(container);

        let summary = "";
        let tooltip = "By spining for "
        let pokemonName = "Milcery (Cheesy)";
        if (spinType == -1)
        {
            container.style.textAlign = "center";
            summary = "3600"
            container.style.marginLeft = "5px";
            tooltip += "3600 seconds in any direction, with any sweet,";
        }
        else
        {
            // Spin count info
            container.style.marginLeft = "10px";
            if (spinType == GameConstants.AlcremieSpins.at5Above10)
            {
                tooltip += "11 seconds or more "
                summary += "11+";
            }
            else if ((spinType == GameConstants.AlcremieSpins.dayClockwiseAbove5)
                     || (spinType == GameConstants.AlcremieSpins.nightClockwiseAbove5)
                     || (spinType == GameConstants.AlcremieSpins.dayCounterclockwiseAbove5)
                     || (spinType == GameConstants.AlcremieSpins.nightCounterclockwiseAbove5))
            {
                tooltip += "5 seconds or more "
                summary += "5+";
            }
            else
            {
                tooltip += "1 to 4 seconds "
                summary += "1→4";
            }

            // Spin direction info
            if ((spinType == GameConstants.AlcremieSpins.dayClockwiseBelow5)
                || (spinType == GameConstants.AlcremieSpins.dayClockwiseAbove5)
                || (spinType == GameConstants.AlcremieSpins.nightClockwiseBelow5)
                || (spinType == GameConstants.AlcremieSpins.nightClockwiseAbove5))
            {
                // Clockwise symbole
                summary += " ↻";
                tooltip += "clockwise"
            }
            else
            {
                // Counter clockwise symbole
                summary += " ↺";
                tooltip += "counter-clockwise"
            }
            pokemonName = sweetData[spinType].name;
        }
        tooltip += ""

        let pokemonId = pokemonMap[pokemonName].id;
        summary += ` : #${pokemonId}`;
        tooltip += `\nyou can get ${pokemonName}`;

        // Set the tooltip
        container.classList.add("hasAutomationTooltip");
        container.classList.add("centeredAutomationTooltip");
        container.classList.add("shortTransitionAutomationTooltip");
        container.style.cursor = "help";
        container.setAttribute("automation-tooltip-text", tooltip);

        container.appendChild(document.createTextNode(summary));

        // Add the caught status placeholder
        const caughtIndicatorElem = document.createElement("span");
        container.appendChild(caughtIndicatorElem);
        this.__internal__caughtPokemonIndicators.set(
            pokemonName, { container: caughtIndicatorElem, pokemonId: pokemonId, currentStatus: null });

        // Add the pokérus status placeholder
        const pokerusIndicatorElem = document.createElement("span");
        pokerusIndicatorElem.style.marginRight = "4px";
        container.appendChild(pokerusIndicatorElem);
        this.__internal__pokemonPokerusIndicators.set(
            pokemonName, { container: pokerusIndicatorElem, pokemonId: pokemonId, currentStatus: null });
    }

    /**
     * @brief Toggle the 'Battle Café' category visibility based on the game state
     *        It will refresh the selected sweet as well
     *
     * The category is only visible the player entered the Battle Café
     */
    static __internal__updateDivVisibilityAndContent()
    {
        if (this.__internal__battleCafeInGameModal.classList.contains("show"))
        {
            const selectedSweet = BattleCafeController.selectedSweet();

            // Refresh caught statuses
            this.__internal__refreshCaughtStatus("Milcery (Cheesy)");
            const currentRewards = BattleCafeController.evolutions[selectedSweet];
            for (const rewardIndex in currentRewards)
            {
                this.__internal__refreshCaughtStatus(currentRewards[rewardIndex].name);
            }

            if (selectedSweet == this.__internal__currentlyVisibleSweet)
            {
                // Nothing changed
                return;
            }

            if (this.__internal__currentlyVisibleSweet != null)
            {
                this.__internal__battleCafeSweetContainers[this.__internal__currentlyVisibleSweet].hidden = true;
            }

            this.__internal__battleCafeSweetContainers[selectedSweet].hidden = false;
            this.__internal__currentlyVisibleSweet = selectedSweet;
        }
    }

    /**
     * @brief Refreshes the caught status of the given @p pokemonName, if it changed
     *
     * @param {string} pokemonName: The name of the pokemon to refresh
     */
    static __internal__refreshCaughtStatus(pokemonName)
    {
        // Refresh the caught status
        const internalCaughtData = this.__internal__caughtPokemonIndicators.get(pokemonName);
        const caughtStatus = Automation.Utils.getPokemonCaughtStatus(internalCaughtData.pokemonId);

        if (caughtStatus != internalCaughtData.currentStatus)
        {
            internalCaughtData.container.innerHTML = Automation.Menu.getCaughtStatusImage(caughtStatus);
            internalCaughtData.container.style.position = "relative";
            internalCaughtData.container.style.bottom = "2px";
            internalCaughtData.container.style.marginLeft = "3px";
            internalCaughtData.currentStatus = caughtStatus;
        }

        // Refresh the pokérus status
        const internalPokerusData = this.__internal__pokemonPokerusIndicators.get(pokemonName);
        const pokerusStatus = PartyController.getPokerusStatus(internalPokerusData.pokemonId);

        if (pokerusStatus != internalPokerusData.currentStatus)
        {
            internalPokerusData.container.innerHTML = Automation.Menu.getPokerusStatusImage(pokerusStatus);
            internalPokerusData.container.style.paddingLeft = (internalPokerusData.container.innerHTML == "") ? "0px" : "3px";
            internalPokerusData.currentStatus = pokerusStatus;
        }
    }
}
