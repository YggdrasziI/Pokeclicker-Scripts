/**
 * @class The AutomationFocusBattleCafe regroups the 'Focus on' button's 'Alcremie forms' functionalities
 */
class AutomationFocusBattleCafe
{
    /******************************************************************************\
    |***    Focus specific members, should only be used by focus sub-classes    ***|
    \******************************************************************************/

    /**
     * @brief Adds the 'Alcremie forms' functionality to the 'Focus on' list
     *
     * @param {Array} functionalitiesList: The list to add the functionality to
     */
    static __registerFunctionalities(functionalitiesList)
    {
        functionalitiesList.push(
            {
                id: "Alcremie",
                name: "Alcremie forms",
                tooltip: "Spins at the Battle Café until every Alcremie form is caught"
                       + Automation.Menu.TooltipSeparator
                       + "The farm is taken over to grow the berries the sweets need,\n"
                       + "then each missing form is spun for. Milcery (Cheesy) comes\n"
                       + "last, it needs a spin of one hour of real time.\n"
                       + "If the in-game hour selector (Simple Time Changer) is there,\n"
                       + "the hour is changed to reach the dusk and night forms,\n"
                       + "and restored once this focus stops. Otherwise, those forms\n"
                       + "wait for the real time of day."
                       + Automation.Menu.TooltipSeparator
                       + "Sweets needing a berry you have none of are skipped.\n"
                       + "⚠️ Spinning consumes berries, in the thousands for some sweets",
                run: function() { this.__internal__start(); }.bind(this),
                stop: function() { this.__internal__stop(); }.bind(this),
                isUnlocked: function() { return App.game.party.alreadyCaughtPokemonByName("Milcery"); },
                refreshRateAsMs: Automation.Focus.__noFunctionalityRefresh
            });
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__alcremieLoop = null;

    // The in-game hour the time selector had before this focus changed it, null if it did not
    static __internal__originalHour = null;

    // The hour to force to reach each part of the day, the night forms being given at dawn as well
    static __internal__hourPerDayCyclePart = new Map([ [ AutomationBattleCafe.__DayCyclePart.Day, 12 ],
                                                       [ AutomationBattleCafe.__DayCyclePart.Dusk, 17 ],
                                                       [ AutomationBattleCafe.__DayCyclePart.Night, 0 ] ]);

    /**
     * @brief Starts the Alcremie forms automation
     */
    static __internal__start()
    {
        // Both features would fight over the same spins and berries
        AutomationBattleCafe.__setAutoSpinSuspended(true, "The 'Focus on Alcremie forms' feature is enabled");

        // Disable other modes button
        const disableReason = "The 'Focus on Alcremie forms' feature is enabled";
        Automation.Menu.setButtonDisabledState(Automation.Farm.Settings.FeatureEnabled, true, disableReason);
        Automation.Menu.setButtonDisabledState(Automation.Farm.Settings.FocusOnUnlocks, true, disableReason);

        // Force enable other modes
        Automation.Farm.toggleAutoFarming(true);

        // Set the Alcremie loop, a spin blocks for its whole duration so there is no point in checking more often
        this.__internal__alcremieLoop = setInterval(this.__internal__focusOnAlcremie.bind(this), 5000); // Runs every 5 seconds
        this.__internal__focusOnAlcremie();
    }

    /**
     * @brief Stops the Alcremie forms automation
     */
    static __internal__stop()
    {
        // Unregister the loop
        clearInterval(this.__internal__alcremieLoop);
        this.__internal__alcremieLoop = null;

        // Reset demands
        Automation.Farm.ForcePlantBerriesAsked = null;

        // Give the in-game hour back
        this.__internal__restoreHour();

        // Reset other modes status
        Automation.Farm.toggleAutoFarming();

        // Re-enable other modes button
        Automation.Menu.setButtonDisabledState(Automation.Farm.Settings.FeatureEnabled, false);
        Automation.Menu.setButtonDisabledState(Automation.Farm.Settings.FocusOnUnlocks, false);
        AutomationBattleCafe.__setAutoSpinSuspended(false);
    }

    /**
     * @brief The Alcremie forms main loop
     *
     * Spins for a missing form whenever its sweet can be afforded, and has the farm grow the
     * berries of the closest sweet otherwise. Milcery (Cheesy) is only spun for once every
     * Alcremie form that can be farmed for is caught.
     */
    static __internal__focusOnAlcremie()
    {
        // A spin is already running, its result is not in yet
        if (BattleCafeController.isSpinning())
        {
            return;
        }

        const timeSelect = document.getElementById("change-time-select");
        const missingBerries = new Set();
        const missingForms = this.__internal__getMissingForms(missingBerries);

        // The forms that can be spun for without waiting for the real time of day
        const currentPart = this.__internal__getDayCyclePartGroup(DayCycle.currentDayCyclePart());
        const spinnableForms = (timeSelect !== null) ? missingForms : missingForms.filter((form) => form.part === currentPart);

        // Prefer the current part of the day, so the hour only changes when there is a reason to
        const affordableForm = spinnableForms.find((form) => (form.part === currentPart) && BattleCafeController.canBuySweet(form.sweet)())
                            ?? spinnableForms.find((form) => BattleCafeController.canBuySweet(form.sweet)());

        if (affordableForm !== undefined)
        {
            this.__internal__spinOrFarm(affordableForm, missingForms);
            return;
        }

        if (missingForms.length !== 0)
        {
            if (this.__internal__askFarmForClosestSweet(missingForms.map((form) => form.sweet)))
            {
                return;
            }

            // Every missing form is affordable, but only at another time of day
            Automation.Farm.ForcePlantBerriesAsked = null;
            Automation.Focus.__reportBlocked("The missing Alcremie forms need another time of day");
            return;
        }

        if (Automation.Utils.getPokemonCaughtStatus(pokemonMap["Milcery (Cheesy)"].id) === CaughtStatus.NotCaught)
        {
            const farmableSweets = this.__internal__getFarmableSweets();

            // Any sweet does, the cheapest one is picked
            const cheesyTarget = farmableSweets.filter((sweet) => BattleCafeController.canBuySweet(sweet)())
                                               .sort((a, b) => this.__internal__getSweetPrice(a) - this.__internal__getSweetPrice(b))
                                               .map((sweet) => ({ sweet, duration: 3600, clockwise: true, part: null }))[0];

            if (cheesyTarget !== undefined)
            {
                this.__internal__spinOrFarm(cheesyTarget, []);
                return;
            }

            if (this.__internal__askFarmForClosestSweet(farmableSweets))
            {
                return;
            }
        }

        Automation.Farm.ForcePlantBerriesAsked = null;

        if (missingBerries.size !== 0)
        {
            const berryNames = [...missingBerries].map((berry) => BerryType[berry]).join(", ");
            Automation.Focus.__reportBlocked(`The missing Alcremie forms need berries you have none of: ${berryNames}`);
        }
        else
        {
            Automation.Focus.__reportBlocked("Every Alcremie form has been caught");
        }
    }

    /**
     * @brief Spins for the given affordable @p target, or keeps farming for the other forms if no spin is left
     *
     * @param target: The { sweet, duration, clockwise, part } to spin for, part being null if any time of day does
     * @param missingForms: The other missing forms, to farm for while no spin is left
     */
    static __internal__spinOrFarm(target, missingForms)
    {
        if (BattleCafeController.spinsLeft() < 1)
        {
            // The spins come back every day, the berries of the next sweets can be grown meanwhile
            if (!this.__internal__askFarmForClosestSweet(missingForms.map((form) => form.sweet)))
            {
                Automation.Farm.ForcePlantBerriesAsked = null;
                Automation.Focus.__reportBlocked("No Battle Café spin left for today");
            }
            return;
        }

        // The berries are there, stop occupying the farm
        Automation.Farm.ForcePlantBerriesAsked = null;

        if ((target.part !== null) && !this.__internal__ensureDayCyclePart(target.part))
        {
            return;
        }

        if (!AutomationBattleCafe.__spin(target))
        {
            Automation.Focus.__reportBlocked("The Battle Café spin duration input could not be found");
        }
    }

    /**
     * @brief Lists the Alcremie forms not caught yet, for the sweets whose berries can be farmed
     *
     * @param {Set} missingBerries: Filled with the berries the player has none of, that some missing form needs
     *
     * @returns An array of { sweet, duration, clockwise, part }, the current part of the day first
     */
    static __internal__getMissingForms(missingBerries)
    {
        const currentPart = this.__internal__getDayCyclePartGroup(DayCycle.currentDayCyclePart());
        const parts = [ currentPart, ...[...this.__internal__hourPerDayCyclePart.keys()].filter((part) => part !== currentPart) ];

        const missingForms = [];
        const seenForms = new Set();

        for (const part of parts)
        {
            for (const spinData of AutomationBattleCafe.__getReachableSpins(part))
            {
                for (const sweetIndex in BattleCafeController.evolutions)
                {
                    const sweet = parseInt(sweetIndex);
                    const reward = BattleCafeController.evolutions[sweetIndex][spinData.spin];

                    // Dusk lists the day spins too, a form is only kept for the first part it was found at
                    if ((reward === undefined)
                        || seenForms.has(reward.name)
                        || (Automation.Utils.getPokemonCaughtStatus(pokemonMap[reward.name].id) !== CaughtStatus.NotCaught))
                    {
                        continue;
                    }
                    seenForms.add(reward.name);

                    const unownedBerries = this.__internal__getUnownedBerries(sweet);
                    if (unownedBerries.length !== 0)
                    {
                        unownedBerries.forEach((berry) => missingBerries.add(berry));
                        continue;
                    }

                    missingForms.push({ sweet, duration: spinData.duration, clockwise: spinData.clockwise, part });
                }
            }
        }

        return missingForms;
    }

    /**
     * @brief Asks the farm to grow the berry the closest of the given @p sweets is furthest from
     *
     * Only the sweets that cannot be afforded yet are considered.
     *
     * @param {Array} sweets: The sweets to consider
     *
     * @returns True if the farm was asked for a berry, false if every sweet is already affordable
     */
    static __internal__askFarmForClosestSweet(sweets)
    {
        let closestSweet = null;
        let closestDeficit = Number.MAX_SAFE_INTEGER;

        for (const sweet of sweets)
        {
            const deficit = AutomationBattleCafe.__getBerryDeficit(sweet);
            if ((deficit > 0) && (deficit < closestDeficit))
            {
                closestDeficit = deficit;
                closestSweet = sweet;
            }
        }

        if (closestSweet === null)
        {
            return false;
        }

        let missingBerry = null;
        let worstDeficit = 0;
        for (const cost of BattleCafeController.getPrice(closestSweet))
        {
            const deficit = cost.amount - App.game.farming.berryInventory[cost.berry]();
            if (deficit > worstDeficit)
            {
                worstDeficit = deficit;
                missingBerry = cost.berry;
            }
        }

        if (Automation.Farm.ForcePlantBerriesAsked !== missingBerry)
        {
            Automation.Farm.ForcePlantBerriesAsked = missingBerry;

            Automation.Notifications.sendNotif(
                `Asked the farm for ${BerryType[missingBerry]} berries (${worstDeficit.toLocaleString('en-US')} missing)`,
                "BattleCafe");
        }

        return true;
    }

    /**
     * @brief Makes sure the in-game time of day is the given @p part, using the in-game hour selector
     *
     * @param part: The DayCyclePart group to reach
     *
     * @returns True if the current time of day is the wanted one, false otherwise
     */
    static __internal__ensureDayCyclePart(part)
    {
        if (this.__internal__getDayCyclePartGroup(DayCycle.currentDayCyclePart()) === part)
        {
            return true;
        }

        const timeSelect = document.getElementById("change-time-select");
        if (timeSelect === null)
        {
            return false;
        }

        if (this.__internal__originalHour === null)
        {
            this.__internal__originalHour = timeSelect.value;
        }

        // The selector's own listener applies the hour
        timeSelect.value = this.__internal__hourPerDayCyclePart.get(part);
        timeSelect.dispatchEvent(new Event("change"));

        Automation.Notifications.sendNotif(`Changed the in-game hour to ${timeSelect.value}:00 for the Battle Café`, "BattleCafe");

        return (this.__internal__getDayCyclePartGroup(DayCycle.currentDayCyclePart()) === part);
    }

    /**
     * @brief Puts back the in-game hour this focus changed, if any
     */
    static __internal__restoreHour()
    {
        if (this.__internal__originalHour === null)
        {
            return;
        }

        const timeSelect = document.getElementById("change-time-select");
        if (timeSelect !== null)
        {
            timeSelect.value = this.__internal__originalHour;
            timeSelect.dispatchEvent(new Event("change"));
        }

        this.__internal__originalHour = null;
    }

    /**
     * @brief Maps a DayCyclePart to the one giving the same Battle Café forms
     *
     * @param part: The DayCyclePart
     *
     * @returns Night for Dawn, the given @p part otherwise
     */
    static __internal__getDayCyclePartGroup(part)
    {
        return (part === AutomationBattleCafe.__DayCyclePart.Dawn) ? AutomationBattleCafe.__DayCyclePart.Night : part;
    }

    /**
     * @brief Lists the berries of the given @p sweet the player has none of, which the farm cannot plant
     *
     * @param sweet: The sweet to check
     *
     * @returns An array of BerryType
     */
    static __internal__getUnownedBerries(sweet)
    {
        return BattleCafeController.getPrice(sweet).filter((cost) => App.game.farming.berryInventory[cost.berry]() <= 0)
                                                   .map((cost) => cost.berry);
    }

    /**
     * @brief Lists the sweets whose berries can all be farmed
     *
     * @returns An array of AlcremieSweet
     */
    static __internal__getFarmableSweets()
    {
        return Object.keys(BattleCafeController.evolutions).map((sweetIndex) => parseInt(sweetIndex))
                     .filter((sweet) => this.__internal__getUnownedBerries(sweet).length === 0);
    }

    /**
     * @brief Computes the total number of berries the given @p sweet costs
     *
     * @param sweet: The sweet
     *
     * @returns The number of berries, all types combined
     */
    static __internal__getSweetPrice(sweet)
    {
        return BattleCafeController.getPrice(sweet).reduce((total, cost) => total + cost.amount, 0);
    }
}
