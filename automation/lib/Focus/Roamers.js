/**
 * @class The AutomationFocusRoamers regroups the 'Focus on' button's 'Roamers' functionalities
 */
class AutomationFocusRoamers
{
    /******************************************************************************\
    |***    Focus specific members, should only be used by focus sub-classes    ***|
    \******************************************************************************/

    /**
     * @brief Adds the 'Roamers' functionality to the 'Focus on' list
     *
     * @param {Array} functionalitiesList: The list to add the functionality to
     */
    static __registerFunctionalities(functionalitiesList)
    {
        functionalitiesList.push(
            {
                id: "Roamers",
                name: "Roamers",
                tooltip: "Hunts for the roaming pokémons the player has not caught yet"
                       + Automation.Menu.TooltipSeparator
                       + "Each region has a route where roamers show up three times more often.\n"
                       + "This focus stays on that route until every roamer of the region is\n"
                       + "caught, then moves on to the next region.\n"
                       + "The 'Roamers' settings tab says what to do once none is missing.",
                run: function() { this.__internal__start(); }.bind(this),
                stop: function() { this.__internal__stop(); }.bind(this),
                fallbackTopics: function() { return this.__internal__getFollowUpTopics(); }.bind(this),
                refreshRateAsMs: Automation.Focus.__noFunctionalityRefresh
            });
    }

    /**
     * @brief Builds the 'Focus on Roamers' advanced settings tab
     *
     * @param {Element} parent: The parent div to add the settings to
     */
    static __buildAdvancedSettings(parent)
    {
        // Disable shiny hunting by default
        Automation.Utils.LocalStorage.setDefaultValue(this.__internal__advancedSettings.HuntShinies, false);

        // Shiny hunting setting
        const shinyTooltip = "A roamer keeps being hunted until its shiny form is caught"
                           + Automation.Menu.TooltipSeparator
                           + "If this option is disabled, a roamer is done with\n"
                           + "as soon as it has been caught once.";
        Automation.Menu.addLabeledAdvancedSettingsToggleButton("Hunt roamers until their shiny form is caught",
                                                               this.__internal__advancedSettings.HuntShinies,
                                                               shinyTooltip,
                                                               parent);

        // Follow-up topics settings
        parent.appendChild(document.createElement("br"));

        const titleDiv = Automation.Menu.createTitleElement("Once every roamer is caught, focus on");
        titleDiv.classList.add("hasAutomationTooltip");
        titleDiv.classList.add("rightMostAutomationTooltip");
        titleDiv.classList.add("shortTransitionAutomationTooltip");
        titleDiv.setAttribute("automation-tooltip-text",
                              "What to focus on while no roamer is missing"
                            + Automation.Menu.TooltipSeparator
                            + "The enabled topics are tried in the order they are listed,\n"
                            + "before the general fallback chain.\n"
                            + "Roamer hunting takes over again as soon as a new roamer\n"
                            + "shows up (a new region, a new quest step, an event...).");
        parent.appendChild(titleDiv);

        for (const topic of this.__internal__followUpTopics)
        {
            // Disable every follow-up by default
            Automation.Utils.LocalStorage.setDefaultValue(this.__internal__getFollowUpSettingKey(topic.id), false);

            Automation.Menu.addLabeledAdvancedSettingsToggleButton(topic.name,
                                                                   this.__internal__getFollowUpSettingKey(topic.id),
                                                                   "",
                                                                   parent);
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__advancedSettings = {
                                              HuntShinies: "Focus-Roamers-HuntShinies"
                                          };

    // The topics the player can chain after the roamers, in the order they are tried.
    // The names are the ones of the 'Focus on' drop-down list
    static __internal__followUpTopics = [
                                            { id: "PokerusCure", name: "Pokérus cure" },
                                            { id: "ShadowPurification", name: "Shadow purify" },
                                            { id: "Quests", name: "Quests" },
                                            { id: "Achievements", name: "Achievements" },
                                            { id: "DungeonTokens", name: "Dungeon Tokens" },
                                            { id: "XP", name: "Experience" },
                                            { id: "Gold", name: "Money" }
                                        ];

    static __internal__roamersLoop = null;

    /**
     * @brief Starts the roamers hunting automation
     */
    static __internal__start()
    {
        // Disable other modes button
        const disableReason = "The 'Focus on Roamers' feature is enabled";
        Automation.Menu.setButtonDisabledState(Automation.Click.Settings.FeatureEnabled, true, disableReason);

        // Force enable other modes
        Automation.Click.toggleAutoClick(true);

        // Set roamers hunting loop
        this.__internal__roamersLoop = setInterval(this.__internal__focusOnRoamers.bind(this), 10000); // Runs every 10 seconds
        this.__internal__focusOnRoamers();
    }

    /**
     * @brief Stops the roamers hunting automation
     */
    static __internal__stop()
    {
        // Unregister the loop
        clearInterval(this.__internal__roamersLoop);
        this.__internal__roamersLoop = null;

        // Disable automation catch filter
        Automation.Utils.Pokeball.disableAutomationFilter();

        // Reset other modes status
        Automation.Click.toggleAutoClick();

        // Re-enable other modes button
        Automation.Menu.setButtonDisabledState(Automation.Click.Settings.FeatureEnabled, false);
    }

    /**
     * @brief The roamers hunting main loop
     *
     * @note If the user is in a state in which he cannot be moved, the feature is automatically disabled.
     */
    static __internal__focusOnRoamers()
    {
        if (!Automation.Focus.__ensureNoInstanceIsInProgress())
        {
            return;
        }

        const target = this.__internal__findNextTarget();

        if (target === null)
        {
            // Nothing left to hunt, hand over to the follow-up topics, then to the fallback chain
            Automation.Utils.Pokeball.disableAutomationFilter();
            Automation.Focus.__reportBlocked("Every reachable roamer has been caught");
            return;
        }

        // Equip the Oak item catch loadout
        Automation.Focus.__equipLoadout(Automation.Utils.OakItem.Setup.PokemonCatch);

        // Ensure that the player has some balls available
        const selectedPokeball = parseInt(Automation.Utils.LocalStorage.getValue(Automation.Focus.Settings.BallToUseToCatch));
        if (!Automation.Focus.__ensurePlayerHasEnoughBalls(selectedPokeball))
        {
            Automation.Utils.Pokeball.disableAutomationFilter();
            return;
        }

        // Only catch the roamers that are still missing, the player's own filters handle the rest
        Automation.Utils.Pokeball.onlyCatchMissingRoamersWith(selectedPokeball, this.__internal__isShinyHuntingEnabled());

        // Move to the best route of the group
        Automation.Utils.Route.moveToRoute(target.route.number, target.route.region);
    }

    /**
     * @brief Finds the next roamer group to hunt in, and the route to do it on
     *
     * Regions are considered in order, so the target only changes once a group is completed.
     *
     * @returns The { region, group, route } to hunt on, or null if no reachable roamer is missing
     */
    static __internal__findNextTarget()
    {
        const highestRegion = Math.min(player.highestRegion(), GameConstants.MAX_AVAILABLE_REGION);

        for (let region = 0; region <= highestRegion; region++)
        {
            if (!Automation.Utils.Route.canMoveToRegion(region))
            {
                continue;
            }

            const groups = RoamingPokemonList.roamerGroups[region] ?? [];

            for (const group of groups.keys())
            {
                if (this.__internal__getMissingRoamers(region, group).length == 0)
                {
                    continue;
                }

                const route = this.__internal__findBestRouteForGroup(region, group);

                // No route of the group can be reached yet
                if (route === null)
                {
                    continue;
                }

                return { region, group, route };
            }
        }

        return null;
    }

    /**
     * @brief Lists the roamers of the given @p group that are currently roaming and still missing
     *
     * @param {number} region: The region of the group
     * @param {number} group: The roamer group index within the region
     *
     * @returns The list of missing RoamingPokemon
     */
    static __internal__getMissingRoamers(region, group)
    {
        const untilShinyCaught = this.__internal__isShinyHuntingEnabled();

        return RoamingPokemonList.getSubRegionalGroupRoamers(region, group).filter(
            (roamer) => !App.game.party.alreadyCaughtPokemonByName(roamer.pokemon.name, untilShinyCaught));
    }

    /**
     * @brief Finds the reachable route of the given @p group with the best roamer encounter rate
     *
     * The game triples the rate on one route of the group, changed every few hours, which beats
     * any other route. Otherwise the rate grows with the route's position in the group.
     *
     * @param {number} region: The region of the group
     * @param {number} group: The roamer group index within the region
     *
     * @returns The route to hunt on, or null if the player can reach none of them
     */
    static __internal__findBestRouteForGroup(region, group)
    {
        const groupSubRegions = RoamingPokemonList.getGroupSubRegions(region, group);
        const reachableRoutes = Routes.getRoutesByRegion(region).filter(
            (route) => groupSubRegions.includes(route.subRegion ?? 0)
                    && Automation.Utils.Route.canMoveToRoute(route.number, region, route));

        if (reachableRoutes.length == 0)
        {
            return null;
        }

        const boostedRoute = RoamingPokemonList.getIncreasedChanceRouteBySubRegionGroup(region, group)?.();
        if (boostedRoute && reachableRoutes.includes(boostedRoute))
        {
            return boostedRoute;
        }

        return reachableRoutes[reachableRoutes.length - 1];
    }

    /**
     * @brief Lists the topics the player asked to chain once every roamer is caught
     *
     * @returns The ordered list of topic ids
     */
    static __internal__getFollowUpTopics()
    {
        return this.__internal__followUpTopics.filter(
            (topic) => Automation.Utils.LocalStorage.getValue(this.__internal__getFollowUpSettingKey(topic.id)) === "true")
            .map((topic) => topic.id);
    }

    /**
     * @brief Gets the setting key of the follow-up toggle of the given @p topicId
     *
     * @param {string} topicId: The topic id
     *
     * @returns The setting key
     */
    static __internal__getFollowUpSettingKey(topicId)
    {
        return `Focus-Roamers-Then${topicId}`;
    }

    /**
     * @brief Tells whether a roamer should be hunted until its shiny form is caught
     *
     * @returns True if the shiny hunting setting is enabled, false otherwise
     */
    static __internal__isShinyHuntingEnabled()
    {
        return (Automation.Utils.LocalStorage.getValue(this.__internal__advancedSettings.HuntShinies) === "true");
    }
}
