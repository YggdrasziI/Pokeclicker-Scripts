/**
 * @class The AutomationFocus regroups the 'Focus on' button functionalities
 */
class AutomationFocus
{
    // Aliases on the other classes
    static Achievements = AutomationFocusAchievements;
    static Quests = AutomationFocusQuests;
    static PokerusCure = AutomationFocusPokerusCure;
    static ShadowPurification = AutomationFocusShadowPurification;

    static Settings = {
                          FeatureEnabled: "Focus-Enabled",
                          FocusedTopic: "Focus-SelectedTopic",
                          FallbackOrder: "Focus-FallbackOrder",
                          OakItemLoadoutUpdate: "Focus-OakItemLoadoutUpdate",
                          BallToUseToCatch: "Focus-BallToUseToCatch"
                      };

    /**
     * @brief Initializes the component
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        // Only consider the BuildMenu init step
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            // Disable 'Focus on' by default
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.FeatureEnabled, false);

            this.__internal__buildFunctionalitiesList();
            this.__internal__buildMenu();
        }
        else if (initStep == Automation.InitSteps.Finalize)
        {
            // Restore previous session state
            this.__internal__toggleFocus();
        }
    }

    /******************************************************************************\
    |***    Focus specific members, should only be used by focus sub-classes    ***|
    \******************************************************************************/

    static __noFunctionalityRefresh = -1;
    static __pokeballToUseSelectElem = null;

    /**
     * @brief Reports that the running topic cannot make any progress right now
     *
     * Until this existed, a topic that ran out of work turned the whole feature off. It now says
     * so instead, and the feature moves on to the next topic of the fallback chain, coming back
     * to the chosen one once it has something to do again. Turning the feature off is still what
     * happens when the entire chain is blocked.
     *
     * @param {string} reason: Why the topic cannot progress, shown to the user if everything is blocked
     */
    static __reportBlocked(reason)
    {
        // Nothing is running, so there is nothing to hand over
        if (this.__internal__activeFocus === null)
        {
            return;
        }

        this.__internal__blockedTopics.set(this.__internal__activeFocus.id, { reason, blockedAt: Date.now() });

        // This is called from inside the topic's own loop callback. Unwinding first keeps the
        // teardown from running underneath the code that asked for it
        if (this.__internal__isSwitchPending)
        {
            return;
        }

        this.__internal__isSwitchPending = true;
        setTimeout(function()
            {
                AutomationFocus.__internal__isSwitchPending = false;
                AutomationFocus.__internal__switchToBestAvailableTopic();
            }, 0);
    }

    /**
     * @brief Makes sure no instance is in progress
     *        It will ask the Dungeon 'Auto fight' feature to stop if enabled
     *
     * @returns True if no instance is in progress, false otherwise
     */
    static __ensureNoInstanceIsInProgress()
    {
        // Ask the dungeon auto-fight to stop, if the feature is enabled
        if (Automation.Utils.LocalStorage.getValue(Automation.Dungeon.Settings.FeatureEnabled) === "true")
        {
            Automation.Dungeon.stopAfterThisRun();
            return false;
        }

        // Disable 'Focus on' if an instance is in progress, and exit
        if (Automation.Utils.isInInstanceState())
        {
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
            Automation.Notifications.sendWarningNotif("Can't run while in an instance\nTurning the feature off", "Focus");
            return false;
        }

        return true;
    }

    /**
     * @brief Moves the player to the best route for EXP farming
     *
     * @note If the user is in a state in which he cannot be moved, the feature is automatically disabled.
     */
    static __goToBestRouteForDungeonToken()
    {
        if (!this.__ensureNoInstanceIsInProgress())
        {
            return;
        }

        const selectedPokeball = parseInt(Automation.Utils.LocalStorage.getValue(this.Settings.BallToUseToCatch));

        // Ensure that the player has some balls available
        if (!this.__ensurePlayerHasEnoughBalls(selectedPokeball))
        {
            return;
        }

        // Equip the Oak item catch loadout
        this.__equipLoadout(Automation.Utils.OakItem.Setup.PokemonCatch);

        // Equip an "Already caught" pokeball
        Automation.Utils.Pokeball.catchEverythingWith(selectedPokeball);

        // Move to the highest unlocked route
        Automation.Utils.Route.moveToHighestDungeonTokenIncomeRoute(selectedPokeball);
    }

    /**
     * @brief Waits for the 'Auto Fight' menu to appear, and then chooses the right opponent and enables it
     *
     * @param {string} gymName
     */
    static __enableAutoGymFight(gymName)
    {
        const menuWatcher = setInterval(function()
            {
                if (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "false")
                {
                    clearInterval(menuWatcher);
                    return;
                }

                for (const option of Automation.Gym.GymSelectElem.options)
                {
                    if (option.value === gymName)
                    {
                        option.selected = true;
                        Automation.Menu.forceAutomationState(Automation.Gym.Settings.FeatureEnabled, true);
                        clearInterval(menuWatcher);
                        break;
                    }
                }
            }.bind(this), 50); // Check every game tick
    }

    /**
     * @brief Moves the player to the best gym to earn the given @p gemType
     *        If no gym is found, moves to the best route to earn the given @p gemType
     *
     * @note If the user is in a state in which he cannot be moved, the feature is automatically disabled.
     */
    static __goToBestGymOrRouteForGem(gemType)
    {
        if (!this.__ensureNoInstanceIsInProgress())
        {
            return;
        }

        const bestGym = Automation.Utils.Gym.findBestGymForFarmingType(gemType);
        const bestRoute = Automation.Utils.Route.findBestRouteForFarmingType(gemType);

        // Compare with a 1/1000 precision
        if ((bestGym !== null) && (Math.ceil(bestGym.Rate * 1000) >= Math.ceil(bestRoute.Rate * 1000)))
        {
            Automation.Utils.Route.moveToTown(bestGym.Town);
            this.__enableAutoGymFight(bestGym.Name);
        }
        else
        {
            Automation.Utils.Route.moveToRoute(bestRoute.Route, bestRoute.Region);
        }
    }

    /**
     * @brief Updates the Oak item loadout with the provided @p loadoutCandidates
     *
     * @note The loadout will only be modified if the OakItemLoadoutUpdate is enabled
     *
     * @see Automation.Utils.OakItem.equipLoadout()
     *
     * @param {Array} loadoutCandidates: The wanted loadout composition
     */
    static __equipLoadout(loadoutCandidates)
    {
        if (Automation.Utils.LocalStorage.getValue(this.Settings.OakItemLoadoutUpdate) === "true")
        {
            Automation.Utils.OakItem.equipLoadout(loadoutCandidates);
        }
    }

    /**
     * @brief Ensures that the player has some balls of the given @p ballType
     *        Otherwise, it will move to the best gym to farm money until it can buy 10 of those
     *
     * @param ballType: The ball type to have
     *
     * @returns True if the player has some, false otherwise
     */
    static __ensurePlayerHasEnoughBalls(ballType)
    {
        // Buy some balls if needed
        if (App.game.pokeballs.getBallQuantity(ballType) === 0)
        {
            const pokeballName = GameConstants.Pokeball[ballType];
            const pokeballItem = ItemList[pokeballName];

            // Hand over if we are not able to buy more balls (for now, only money currency is supported).
            // A topic that does not catch anything can still make progress in the meantime
            if (pokeballItem.currency != GameConstants.Currency.money)
            {
                this.__reportBlocked("No more pokéball of the selected type are available");
                return false;
            }

            // No more money, or too expensive, go farm some money
            if ((App.game.wallet.currencies[GameConstants.Currency.money]() < pokeballItem.totalPrice(10))
                || (pokeballItem.totalPrice(1) !== pokeballItem.basePrice))
            {
                this.__internal__goToBestGymForMoney();
                return false;
            }

            pokeballItem.buy(10);
        }

        return true;
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__focusLoop = null;
    static __internal__activeFocus = null;
    static __internal__focusSelectElem = null;

    static __internal__functionalities = [];
    static __internal__lockedFunctionalities = [];

    static __internal__lastFocusData = null;

    // The topic the player picked in the dropdown, as opposed to whichever one is running now
    static __internal__wantedTopicId = null;

    // topic id -> { reason, blockedAt }, for the topics that reported they cannot progress
    static __internal__blockedTopics = new Map();

    static __internal__supervisorLoop = null;
    static __internal__isSwitchPending = false;

    static __internal__fallbackSelectElems = [];

    // How long a topic stays out of the running order after reporting itself blocked. What blocks
    // a topic is usually something the player can undo, so it is worth re-testing periodically
    static __internal__blockedTopicRetryDelayMs = 15 * 60 * 1000;

    // Only needs to be often enough to notice the chosen topic became possible again
    static __internal__supervisorIntervalMs = 60000;

    // How many fallbacks the user can order. A full drag-and-drop list over the twenty-odd topics
    // would be far more UI than the choice deserves
    static __internal__fallbackSlotCount = 3;

    /**
     * @brief Builds the menu
     *
     * The 'Focus on' functionality is disabled by default (if never set in a previous session)
     */
    static __internal__buildMenu()
    {
        // Add the related buttons to the automation menu
        const focusContainer = document.createElement("div");
        focusContainer.style.textAlign = "center";
        Automation.Menu.AutomationButtonsDiv.appendChild(focusContainer);

        // Add the title
        const titleDiv = Automation.Menu.createTitleElement("Focus on");
        focusContainer.appendChild(titleDiv);

        // Button and list container
        const buttonContainer = document.createElement("div");
        buttonContainer.style.textAlign = "right";
        buttonContainer.classList.add("hasAutomationTooltip");
        focusContainer.appendChild(buttonContainer);

        // Add the drop-down list
        this.__internal__focusSelectElem = Automation.Menu.createDropDownListElement("focusSelection");
        this.__internal__focusSelectElem.style.width = "calc(100% - 55px)";
        this.__internal__focusSelectElem.style.paddingLeft = "3px";
        buttonContainer.appendChild(this.__internal__focusSelectElem);

        this.__internal__populateFocusOptions();
        this.__internal__focusOnChanged(false);
        this.__internal__focusSelectElem.onchange = function() { Automation.Focus.__internal__focusOnChanged(); };

        // Add the 'Focus on' button
        const focusButton = Automation.Menu.createButtonElement(this.Settings.FeatureEnabled);
        const isFeatureEnabled = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        focusButton.textContent = (isFeatureEnabled ? "On" : "Off");
        focusButton.classList.add(isFeatureEnabled ? "btn-success" : "btn-danger");
        focusButton.onclick = function() { Automation.Menu.toggleButtonState(this.Settings.FeatureEnabled) }.bind(this);
        focusButton.style.marginTop = "3px";
        focusButton.style.marginLeft = "5px";
        focusButton.style.marginRight = "10px";
        buttonContainer.appendChild(focusButton);

        // Toggle the 'Focus on' loop on click
        focusButton.addEventListener("click", this.__internal__toggleFocus.bind(this), false);

        // Build advanced settings
        this.__internal__buildAdvancedSettings(focusContainer);

        // Set an unlock watcher if needed
        if (this.__internal__lockedFunctionalities.length != 0)
        {
            this.__internal__setUnlockWatcher();
        }
    }

    /**
     * @brief Builds the 'Focus on' feature advanced settings panel
     *
     * @param {Element} parent: The parent div to add the settings to
     */
    static __internal__buildAdvancedSettings(parent)
    {
        // Build advanced settings panel
        const focusSettingPanel = Automation.Menu.addSettingPanel(parent);
        focusSettingPanel.style.textAlign = "right";

        const titleDiv = Automation.Menu.createTitleElement("'Focus on' advanced settings");
        titleDiv.style.marginBottom = "10px";
        focusSettingPanel.appendChild(titleDiv);

        const focusSettingsTabsGroup = "automationFocusSettings";
        const generalTabContainer = Automation.Menu.addTabElement(focusSettingPanel, "General", focusSettingsTabsGroup);

        /**********************\
        |*   Balls settings   *|
        \**********************/

        this.__internal__buildBallSelectionAdvancedSettings(generalTabContainer);

        /**********************\
        |*  Toggles settings  *|
        \**********************/

        // Add some space
        generalTabContainer.appendChild(document.createElement("br"));

        // OakItem loadout setting
        const disableOakItemTooltip = "Modifies the oak item loadout automatically";
        Automation.Menu.addLabeledAdvancedSettingsToggleButton("Optimize oak item loadout",
                                                               this.Settings.OakItemLoadoutUpdate,
                                                               disableOakItemTooltip,
                                                               generalTabContainer);

        /*********************\
        |*  Fallback chain   *|
        \*********************/

        this.__internal__buildFallbackAdvancedSettings(generalTabContainer);

        /*********************\
        |*  Quests settings  *|
        \*********************/

        const questTabContainer = Automation.Menu.addTabElement(focusSettingPanel, "Quests", focusSettingsTabsGroup);
        this.Quests.__buildAdvancedSettings(questTabContainer);

        /***************************\
        |*  Achievements settings  *|
        \***************************/

        const achievementsTabContainer = Automation.Menu.addTabElement(focusSettingPanel, "Achievements", focusSettingsTabsGroup);
        this.Achievements.__buildAdvancedSettings(achievementsTabContainer);

        /***************************\
        |*  Pokérus Cure settings  *|
        \***************************/

        const pokerusCureTabContainer = Automation.Menu.addTabElement(focusSettingPanel, "Pokérus Cure", focusSettingsTabsGroup);
        this.PokerusCure.__buildAdvancedSettings(pokerusCureTabContainer);
    }

    /**
     * @brief Builds the fallback chain settings
     *
     * One ordered dropdown per fallback slot, all written back into a single comma-separated
     * setting. The topics themselves are the same list the main dropdown offers, minus the
     * separators, which are not selectable.
     *
     * @param {Element} generalTabContainer: The tab container
     */
    static __internal__buildFallbackAdvancedSettings(generalTabContainer)
    {
        generalTabContainer.appendChild(document.createElement("br"));

        const titleDiv = Automation.Menu.createTitleElement("Fall back to, in order");
        titleDiv.classList.add("hasAutomationTooltip");
        titleDiv.classList.add("rightMostAutomationTooltip");
        titleDiv.classList.add("shortTransitionAutomationTooltip");
        titleDiv.setAttribute("automation-tooltip-text",
                              "What to focus on while the chosen topic has nothing left to do"
                            + Automation.Menu.TooltipSeparator
                            + "A topic that runs out of work hands over instead of switching\n"
                            + "the feature off, and gets it back as soon as it can progress\n"
                            + "again. The feature only stops once the whole chain is stuck");
        generalTabContainer.appendChild(titleDiv);

        const savedOrder = this.__internal__getFallbackOrder();

        for (const slotIndex of Array(this.__internal__fallbackSlotCount).keys())
        {
            const container = document.createElement("div");
            container.style.textAlign = "right";
            container.style.marginTop = "3px";
            container.style.paddingRight = "10px";
            generalTabContainer.appendChild(container);

            container.appendChild(document.createTextNode(`${slotIndex + 1}. `));

            const selectElem = Automation.Menu.createDropDownListElement(`focusFallback-${slotIndex}`);
            selectElem.style.width = "calc(100% - 30px)";
            selectElem.style.paddingLeft = "3px";
            container.appendChild(selectElem);

            const noneOption = document.createElement("option");
            noneOption.textContent = "None";
            noneOption.value = "";
            selectElem.options.add(noneOption);

            for (const functionality of this.__internal__functionalities)
            {
                // Separators are headings, not topics
                if (functionality.id === "separator")
                {
                    continue;
                }

                const opt = document.createElement("option");
                opt.textContent = functionality.name;
                opt.value = functionality.id;
                selectElem.options.add(opt);
            }

            selectElem.value = savedOrder[slotIndex] ?? "";
            selectElem.onchange = this.__internal__onFallbackOrderChanged.bind(this);

            this.__internal__fallbackSelectElems.push(selectElem);
        }
    }

    /**
     * @brief Saves the fallback chain from the slot dropdowns
     *
     * The same topic picked twice would only ever be tried once, so duplicates are dropped rather
     * than left to look like they do something.
     */
    static __internal__onFallbackOrderChanged()
    {
        const order = [];

        for (const selectElem of this.__internal__fallbackSelectElems)
        {
            if ((selectElem.value !== "") && !order.includes(selectElem.value))
            {
                order.push(selectElem.value);
            }
        }

        Automation.Utils.LocalStorage.setValue(this.Settings.FallbackOrder, order.join(","));
    }

    /**
     * @brief Builds the ball selection advanced settings drop-down lists
     *
     * @param {Element} generalTabContainer: The tab container
     */
    static __internal__buildBallSelectionAdvancedSettings(generalTabContainer)
    {
        const disclaimer = Automation.Menu.TooltipSeparator + "⚠️ Equipping higher pokéballs can be cost-heavy during early game";

        // Pokeball to use for catching
        const pokeballToUseTooltip = "Defines which pokeball will be equipped to catch\n"
                                   + "already caught pokémon, when needed"
                                   + disclaimer;

        this.__internal__setBallToUseToCatchDefaultValue();

        this.__pokeballToUseSelectElem = Automation.Menu.addPokeballList(this.Settings.BallToUseToCatch,
                                                                         "Pokeball to use for catching",
                                                                         pokeballToUseTooltip);
        generalTabContainer.appendChild(this.__pokeballToUseSelectElem);
    }

    /**
     * @brief Toggles the 'Focus on' feature
     *
     * If the feature was enabled and it's toggled to disabled, the loop will be stopped.
     * If the feature was disabled and it's toggled to enabled, the loop will be started.
     *
     * @param enable: [Optional] If a boolean is passed, it will be used to set the right state.
     *                Otherwise, the local storage value will be used
     */
    static __internal__toggleFocus(enable)
    {
        // If we got the click event, use the button status
        if ((enable !== true) && (enable !== false))
        {
            enable = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        }

        if (enable)
        {
            // Only start if nothing is running yet. Topics that own their loop leave
            // __internal__focusLoop null, so the active topic is what says whether we are running
            if (this.__internal__activeFocus === null)
            {
                // The dropdown holds the topic the player asked for. The fallback chain may run
                // something else for a while, but this is what we always come back to
                this.__internal__wantedTopicId = this.__internal__focusSelectElem.value;

                // A fresh run deserves a fresh assessment of what is blocked
                this.__internal__blockedTopics.clear();

                const wantedFocus =
                    this.__internal__functionalities.filter((functionality) => functionality.id === this.__internal__wantedTopicId)[0];

                this.__internal__startTopic(wantedFocus);

                // Watches for the chosen topic becoming possible again
                this.__internal__supervisorLoop =
                    setInterval(this.__internal__switchToBestAvailableTopic.bind(this), this.__internal__supervisorIntervalMs);
            }
        }
        else
        {
            clearInterval(this.__internal__supervisorLoop);
            this.__internal__supervisorLoop = null;

            this.__internal__stopActiveTopic();

            this.__internal__wantedTopicId = null;
            this.__internal__blockedTopics.clear();
        }
    }

    /**
     * @brief Starts the given @p functionality
     *
     * @param functionality: The focus topic to start
     */
    static __internal__startTopic(functionality)
    {
        this.__internal__activeFocus = functionality;

        // Set focus loop if needed
        if (functionality.refreshRateAsMs !== this.__noFunctionalityRefresh)
        {
            this.__internal__focusLoop = setInterval(functionality.run, functionality.refreshRateAsMs);
        }

        // First loop run (to avoid waiting too long before the first iteration, in case of long refresh rate)
        functionality.run();
    }

    /**
     * @brief Stops whichever topic is currently running, if any
     */
    static __internal__stopActiveTopic()
    {
        // Unregister the loop
        clearInterval(this.__internal__focusLoop);

        if (this.__internal__activeFocus !== null)
        {
            if (this.__internal__activeFocus.stop !== undefined)
            {
                // Reset any dungeon request that might have occured
                Automation.Dungeon.stopAfterThisRun();

                this.__internal__activeFocus.stop();
            }
            this.__internal__activeFocus = null;
        }

        this.__internal__focusLoop = null;
        this.__internal__lastFocusData = null;
    }

    /**
     * @brief Runs the first topic of the chain that can currently make progress
     *
     * Called both when a topic reports itself blocked and on a timer, which is what brings the
     * chosen topic back as soon as its block expires.
     */
    static __internal__switchToBestAvailableTopic()
    {
        // The player may have switched the feature off in the meantime
        if (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) !== "true")
        {
            return;
        }

        const candidate = this.__internal__findBestAvailableTopic();

        if (candidate === null)
        {
            // Everything in the chain is blocked, which is what the feature used to do on the
            // very first blocked topic: say why and switch off
            const blockedReasons = [ ...this.__internal__blockedTopics.values() ].map((blocked) => blocked.reason);
            const lastReason = (blockedReasons.length > 0) ? blockedReasons[blockedReasons.length - 1]
                                                           : "Nothing left to focus on";

            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
            Automation.Notifications.sendWarningNotif(`${lastReason}\nNo other focus available, turning the feature off`, "Focus");
            return;
        }

        // Already running the best option
        if ((this.__internal__activeFocus !== null) && (this.__internal__activeFocus.id === candidate.id))
        {
            return;
        }

        const previousName = this.__internal__activeFocus?.name;

        this.__internal__stopActiveTopic();
        this.__internal__startTopic(candidate);

        if (previousName !== undefined)
        {
            Automation.Notifications.sendNotif(`${previousName} is stuck, focusing on ${candidate.name} instead`, "Focus");
        }
    }

    /**
     * @brief Picks the first topic of the chain that is neither blocked nor locked
     *
     * The chain is the chosen topic first, then the user-ordered fallbacks. The chosen topic
     * always comes first, so the moment its block expires it takes over again.
     *
     * @returns The functionality to run, or null if every one of them is unavailable
     */
    static __internal__findBestAvailableTopic()
    {
        const orderedIds = [ this.__internal__wantedTopicId, ...this.__internal__getFallbackOrder() ];

        for (const topicId of orderedIds)
        {
            if (!topicId)
            {
                continue;
            }

            const functionality = this.__internal__functionalities.find((candidate) => candidate.id === topicId);

            if ((functionality === undefined)
                || this.__internal__isTopicBlocked(topicId)
                || ((functionality.isUnlocked !== undefined) && !functionality.isUnlocked()))
            {
                continue;
            }

            return functionality;
        }

        return null;
    }

    /**
     * @brief Tells whether the given @p topicId is currently known to be stuck
     *
     * A block expires on its own: what stopped a topic is usually something the player can undo,
     * and re-testing costs one loop iteration.
     *
     * @param {string} topicId: The topic to check
     *
     * @returns True if the topic reported itself blocked recently enough, False otherwise
     */
    static __internal__isTopicBlocked(topicId)
    {
        const blocked = this.__internal__blockedTopics.get(topicId);

        if (blocked === undefined)
        {
            return false;
        }

        if ((Date.now() - blocked.blockedAt) >= this.__internal__blockedTopicRetryDelayMs)
        {
            this.__internal__blockedTopics.delete(topicId);
            return false;
        }

        return true;
    }

    /**
     * @brief Reads the user-configured fallback chain
     *
     * @returns An array of topic ids, in the order they should be tried
     */
    static __internal__getFallbackOrder()
    {
        const stored = Automation.Utils.LocalStorage.getValue(this.Settings.FallbackOrder);

        if (!stored)
        {
            return [];
        }

        return stored.split(",").filter((topicId) => topicId !== "");
    }

    /**
     * @brief Build the list of available elements that the player will be able to set the focus on
     */
    static __internal__buildFunctionalitiesList()
    {
        this.__internal__functionalities.push(
            {
                id: "XP",
                name: "Experience",
                tooltip: "Automatically moves to the best route for EXP"
                       + Automation.Menu.TooltipSeparator
                       + "Such route is the highest unlocked one\n"
                       + "with HP lower than Click Attack",
                run: function() { this.__internal__goToBestRouteForExp(); }.bind(this),
                refreshRateAsMs: 10000 // Refresh every 10s
            });

        this.__internal__functionalities.push(
            {
                id: "Gold",
                name: "Money",
                tooltip: "Automatically moves to the best gym for money"
                       + Automation.Menu.TooltipSeparator
                       + "Gyms gives way more money than routes\n"
                       + "The best gym is the one that gives the most money per game tick",
                run: function() { this.__internal__goToBestGymForMoney(); }.bind(this),
                stop: function() { Automation.Menu.forceAutomationState(Automation.Gym.Settings.FeatureEnabled, false); },
                refreshRateAsMs: 10000 // Refresh every 10s
            });

        this.__internal__functionalities.push(
            {
                id: "DungeonTokens",
                name: "Dungeon Tokens",
                tooltip: "Moves to the best route to earn dungeon tokens"
                       + Automation.Menu.TooltipSeparator
                       + "The most efficient route is the one giving\n"
                       + "the most token per game tick.\n"
                       + "The most efficient Oak items loadout will be equipped.\n"
                       + "The configured balls will automatically be used and bought if needed.",
                run: function() { this.__goToBestRouteForDungeonToken(); }.bind(this),
                stop: function()
                    {
                        Automation.Menu.forceAutomationState(Automation.Gym.Settings.FeatureEnabled, false);
                        Automation.Utils.Pokeball.disableAutomationFilter();
                    }.bind(this),
                refreshRateAsMs: 3000 // Refresh every 3s
            });

        this.Quests.__registerFunctionalities(this.__internal__functionalities);
        this.Achievements.__registerFunctionalities(this.__internal__functionalities);
        this.PokerusCure.__registerFunctionalities(this.__internal__functionalities);
        this.ShadowPurification.__registerFunctionalities(this.__internal__functionalities);

        this.__internal__addGemsFocusFunctionalities();
    }

    /**
     * @brief Adds a separator to the focus drop-down list
     *
     * @param {string} title: The separator text to display
     * @param {CallableFunction} isUnlockedCallback: The condition to display the separator
     */
    static __internal__addFunctionalitySeparator(title, isUnlockedCallback = function() { return true; })
    {
        this.__internal__functionalities.push({ id: "separator", name: title, tooltip: "", isUnlocked: isUnlockedCallback });
    }

    /**
     * @brief Registers all gem focus features to the drop-down list
     */
    static __internal__addGemsFocusFunctionalities()
    {
        const isUnlockedCallback = function() { return App.game.gems.canAccess(); };
        this.__internal__addFunctionalitySeparator("==== Gems ====", isUnlockedCallback);

        // Sort the types alphabetically
        const gemListCopy = [...Array(Gems.nTypes).keys()];
        gemListCopy.sort((a, b) => (PokemonType[a] < PokemonType[b]) ? -1 : 1);

        for (const gemType of gemListCopy)
        {
            const gemTypeName = PokemonType[gemType];

            this.__internal__functionalities.push(
                {
                    id: gemTypeName + "Gems",
                    name: gemTypeName + " Gems",
                    tooltip: "Moves to the best gym or route to earn " + gemTypeName + " gems"
                           + Automation.Menu.TooltipSeparator
                           + "The best location is the one that will give the most\n"
                           + gemTypeName + " gems per game tick.\n"
                           + "Both gyms and routes are considered, the best one will be used.",
                    run: function() { this.__goToBestGymOrRouteForGem(gemType); }.bind(this),
                    stop: function() { Automation.Menu.forceAutomationState(Automation.Gym.Settings.FeatureEnabled, false); },
                    isUnlocked: isUnlockedCallback,
                    refreshRateAsMs: 10000 // Refresh every 10s
                });
        }
    }

    /**
     * @brief Populates the drop-down list based on the registered functionalities
     *
     * If any functionality is locked, the corresponding focus topic will be hidden to the player.
     */
    static __internal__populateFocusOptions()
    {
        const lastAutomationFocusedTopic = Automation.Utils.LocalStorage.getValue(this.Settings.FocusedTopic);
        for (const functionality of this.__internal__functionalities)
        {
            const opt = document.createElement("option");

            if ((functionality.isUnlocked !== undefined)
                && !functionality.isUnlocked())
            {
                this.__internal__lockedFunctionalities.push({ functionality, opt });
                opt.hidden = true;
            }

            if (functionality.id == "separator")
            {
                opt.disabled = true;
            }
            else
            {
                opt.value = functionality.id;
                opt.id = functionality.id;

                if (!opt.hidden && (lastAutomationFocusedTopic === functionality.id))
                {
                    // Restore previous session selected element
                    opt.selected = true;
                }
            }
            opt.textContent = functionality.name;

            this.__internal__focusSelectElem.options.add(opt);
        }
    }

    /**
     * @brief Watches for the in-game functionalities and balls to be available.
     *        Once available, the corresponding drop-down list item will be displayed to the user
     */
    static __internal__setUnlockWatcher()
    {
        const watcher = setInterval(function()
            {
                // Reverse iterate to avoid any problem that would be cause by element removal
                for (var i = this.__internal__lockedFunctionalities.length - 1; i >= 0; i--)
                {
                    if (this.__internal__lockedFunctionalities[i].functionality.isUnlocked())
                    {
                        // Make the element visible
                        this.__internal__lockedFunctionalities[i].opt.hidden = false;

                        // Remove the functionality from the locked list
                        this.__internal__lockedFunctionalities.splice(i, 1);
                    }
                }

                if (this.__internal__lockedFunctionalities.length == 0)
                {
                    // No more missing element, unregister the loop
                    clearInterval(watcher);
                }
            }.bind(this), 5000); // Refresh every 5s
    }

    /**
     * @brief Updates the tooltip and action on selected value changed event
     *
     * If a 'Focus on' action was in progress, it will be stopped
     *
     * @param {boolean} forceOff: If set to True (default value) the 'Focus on' feature will be turned off
     */
    static __internal__focusOnChanged(forceOff = true)
    {
        // Stop the current loop if any, and turn the button off
        if (forceOff)
        {
            // Stop the current loop if any, and disable the button
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
        }

        // Update the tooltip
        const activeFocus = this.__internal__functionalities.filter((functionality) => functionality.id === this.__internal__focusSelectElem.value)[0];
        this.__internal__focusSelectElem.parentElement.setAttribute("automation-tooltip-text", activeFocus.tooltip);

        // Save the last selected topic
        Automation.Utils.LocalStorage.setValue(this.Settings.FocusedTopic, this.__internal__focusSelectElem.value);
    }

    /**
     * @brief Moves the player to the best route for EXP farming
     *
     * @note If the user is in a state in which he cannot be moved, the feature is automatically disabled.
     *
     * @see Automation.Utils.Route.moveToBestRouteForExp
     */
    static __internal__goToBestRouteForExp()
    {
        if (!this.__ensureNoInstanceIsInProgress())
        {
            return;
        }

        // Equip the most effective Oak item loadout for XP farming
        this.__equipLoadout(Automation.Utils.OakItem.Setup.PokemonExp);

        Automation.Utils.Route.moveToBestRouteForExp();
    }

    /**
     * @brief Moves the player to the best gym for Money farming
     *
     * @note If the user is in a state in which he cannot be moved, the feature is automatically disabled.
     */
    static __internal__goToBestGymForMoney()
    {
        if (!this.__ensureNoInstanceIsInProgress())
        {
            return;
        }

        // Only compute the gym the first time, since there is almost no chance that it will change while the feature is active
        if (this.__internal__lastFocusData === null)
        {
            this.__internal__lastFocusData = Automation.Utils.Gym.findBestGymForMoney();
        }

        // Equip the 'money' Oak loadout
        this.__equipLoadout(Automation.Utils.OakItem.Setup.Money);

        // Fallback to the exp route if no gym can be found
        if (this.__internal__lastFocusData.bestGymTown === null)
        {
            Automation.Utils.Route.moveToBestRouteForExp();
            return;
        }

        Automation.Utils.Route.moveToTown(this.__internal__lastFocusData.bestGymTown);
        this.__enableAutoGymFight(this.__internal__lastFocusData.bestGym);
    }

    /**
     * @brief Sets the default value of the BallToUseToCatch setting
     */
    static __internal__setBallToUseToCatchDefaultValue()
    {
        // Set the most effective available ball in priority
        for (const ball of [ GameConstants.Pokeball.Ultraball, GameConstants.Pokeball.Greatball, GameConstants.Pokeball.Pokeball ])
        {
            if (App.game.pokeballs.pokeballs[ball].unlocked())
            {
                Automation.Utils.LocalStorage.setDefaultValue(this.Settings.BallToUseToCatch, ball);
                break;
            }
        }
    }
}
