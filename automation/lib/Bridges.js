/**
 * @class The AutomationBridges keeps this automation and the Ephenia userscripts from
 *        fighting each other.
 *
 * Both projects automate overlapping things: two auto-clickers, two miners or two hatcheries
 * running at once compete for the same resource (the player's position, the egg slots, the
 * mining tools) and produce erratic behaviour. Rather than relying on the player to remember
 * which pairs are incompatible, enabling one side offers to switch the other one off.
 *
 * The guard works in both directions:
 *   - Every automation feature toggle goes through Automation.Menu.toggleButtonState, which is
 *     wrapped here.
 *   - The Ephenia scripts are caught with a single capture-phase listener on the document, so
 *     it does not matter when their buttons are injected, or that some live inside modals.
 */
class AutomationBridges
{
    /**
     * @brief The incompatible pairs
     *
     * Only hard conflicts are listed: cases where both sides drive the same loop. Ephenia's
     * autobattlefrontier is deliberately absent -- it has no loop of its own, it rewrites the
     * Battle Frontier start button to add stage resetting, which complements 'Auto start'
     * rather than competing with it.
     */
    static Conflicts = [
        {
            automationSetting: "Click-Enabled",
            automationName: "Auto attack",
            ephenia: [ { id: "auto-click-start", name: "Auto Click" } ]
        },
        {
            automationSetting: "Gym-FightEnabled",
            automationName: "Gym Auto Fight",
            ephenia: [ { id: "auto-gym-start", name: "Auto Gym" } ]
        },
        {
            automationSetting: "Dungeon-FightEnabled",
            automationName: "Dungeon Auto Fight",
            ephenia: [ { id: "auto-dungeon-start", name: "Auto Dungeon" } ]
        },
        {
            // 'Focus on' walks the player between routes, gyms and dungeons, so anything that
            // also controls where the player stands will fight it for the wheel
            automationSetting: "Focus-Enabled",
            automationName: "Focus on",
            ephenia: [ { id: "auto-gym-start", name: "Auto Gym" },
                       { id: "auto-dungeon-start", name: "Auto Dungeon" },
                       { id: "toggle-auto-quest", name: "Auto Quest Completer" } ]
        },
        {
            automationSetting: "Hatchery-Enabled",
            automationName: "Hatchery",
            ephenia: [ { id: "auto-hatch-start", name: "Auto Hatchery" } ]
        },
        {
            automationSetting: "Mining-Enabled",
            automationName: "Mining",
            ephenia: [ { id: "auto-mine-start", name: "Auto Mine" } ]
        },
        {
            automationSetting: "Farming-Enabled",
            automationName: "Farming",
            ephenia: [ { id: "auto-plant-toggle", name: "Auto Plant" },
                       { id: "auto-harvest-toggle", name: "Auto Harvest" },
                       { id: "auto-replant-toggle", name: "Auto Replant" },
                       { id: "auto-mulch-toggle", name: "Auto Mulch" } ]
        }
    ];

    /**
     * @brief Installs the guards
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        // The Ephenia scripts build their buttons during their own init, so wait for everything
        // to have settled before listening
        if (initStep != Automation.InitSteps.Finalize) return;

        this.__internal__guardAutomationToggles();
        this.__internal__guardEpheniaToggles();
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    // Set while re-dispatching a click the player already confirmed
    static __internal__bypassedButtonId = null;

    /**
     * @brief Wraps the automation's toggle entry point, to catch a feature being turned on
     */
    static __internal__guardAutomationToggles()
    {
        const originalToggle = Automation.Menu.toggleButtonState.bind(Automation.Menu);

        Automation.Menu.toggleButtonState = function(id)
            {
                const isTurningOn = (Automation.Utils.LocalStorage.getValue(id) !== "true");
                const conflicts = isTurningOn ? AutomationBridges.__internal__activeEpheniaConflicts(id) : [];

                if (conflicts.length === 0)
                {
                    originalToggle(id);
                    return;
                }

                const conflict = AutomationBridges.Conflicts.find((c) => c.automationSetting === id);
                AutomationBridges.__internal__askToDisable(conflict.automationName,
                                                           conflicts.map((c) => c.name))
                    .then((confirmed) =>
                        {
                            if (!confirmed)
                            {
                                return;
                            }
                            conflicts.forEach((c) => AutomationBridges.__internal__disableEpheniaFeature(c.id));
                            originalToggle(id);
                        });
            };
    }

    /**
     * @brief Catches an Ephenia toggle being turned on, before its own handler runs
     */
    static __internal__guardEpheniaToggles()
    {
        document.addEventListener("click", function(event)
            {
                const button = event.target?.closest?.("[id]");
                if (!button)
                {
                    return;
                }

                if (AutomationBridges.__internal__bypassedButtonId === button.id)
                {
                    AutomationBridges.__internal__bypassedButtonId = null;
                    return;
                }

                // Only guard when the button is about to be turned on
                if (!AutomationBridges.__internal__isEpheniaButton(button.id)
                    || AutomationBridges.__internal__isEpheniaEnabled(button.id))
                {
                    return;
                }

                const conflicts = AutomationBridges.__internal__activeAutomationConflicts(button.id);
                if (conflicts.length === 0)
                {
                    return;
                }

                // Hold the click back until the player has answered
                event.preventDefault();
                event.stopImmediatePropagation();

                const buttonName = AutomationBridges.__internal__epheniaFeatureName(button.id);
                AutomationBridges.__internal__askToDisable(buttonName,
                                                           conflicts.map((c) => c.automationName))
                    .then((confirmed) =>
                        {
                            if (!confirmed)
                            {
                                return;
                            }
                            conflicts.forEach((c) => Automation.Menu.forceAutomationState(c.automationSetting, false));

                            // Let the original handler run this time
                            AutomationBridges.__internal__bypassedButtonId = button.id;
                            button.click();
                        });
            }, true); // capture, so this runs before the scripts' own listeners
    }

    /**
     * @brief Asks the player whether the conflicting features should be turned off
     *
     * @param {string} enabledFeature: The feature being turned on
     * @param {Array} toDisable: The names of the features that would be turned off
     *
     * @returns A promise resolving to true if the player confirmed
     */
    static __internal__askToDisable(enabledFeature, toDisable)
    {
        const list = toDisable.map((name) => `• ${name}`).join("\n");
        return Notifier.confirm({
                                    title: "Conflicting automation",
                                    message: `'${enabledFeature}' cannot run at the same time as:\n\n${list}\n\n`
                                           + "Turn them off and continue?",
                                    confirm: "Turn off"
                                });
    }

    /**
     * @brief Lists the enabled Ephenia features conflicting with the given automation @p setting
     */
    static __internal__activeEpheniaConflicts(setting)
    {
        const conflict = this.Conflicts.find((c) => c.automationSetting === setting);
        if (!conflict)
        {
            return [];
        }
        return conflict.ephenia.filter((e) => this.__internal__isEpheniaEnabled(e.id));
    }

    /**
     * @brief Lists the enabled automation features conflicting with the given Ephenia @p buttonId
     */
    static __internal__activeAutomationConflicts(buttonId)
    {
        return this.Conflicts.filter((c) => c.ephenia.some((e) => e.id === buttonId)
                                         && (Automation.Utils.LocalStorage.getValue(c.automationSetting) === "true"));
    }

    static __internal__isEpheniaButton(buttonId)
    {
        return this.Conflicts.some((c) => c.ephenia.some((e) => e.id === buttonId));
    }

    static __internal__epheniaFeatureName(buttonId)
    {
        for (const conflict of this.Conflicts)
        {
            const match = conflict.ephenia.find((e) => e.id === buttonId);
            if (match)
            {
                return match.name;
            }
        }
        return buttonId;
    }

    /**
     * @brief Tells whether an Ephenia feature is currently running
     *
     * Every one of those scripts shows its state through the bootstrap button colour, which is
     * the only thing they all have in common: two of them keep their state in a closure, out of
     * reach entirely.
     */
    static __internal__isEpheniaEnabled(buttonId)
    {
        const button = document.getElementById(buttonId);
        return (button != null) && button.classList.contains("btn-success");
    }

    /**
     * @brief Turns an Ephenia feature off
     *
     * Clicking the button rather than writing to local storage keeps the script's own state,
     * its stored value and its button label in agreement.
     */
    static __internal__disableEpheniaFeature(buttonId)
    {
        const button = document.getElementById(buttonId);
        if ((button == null) || !button.classList.contains("btn-success"))
        {
            return;
        }

        this.__internal__bypassedButtonId = buttonId;
        button.click();
        this.__internal__bypassedButtonId = null;
    }
}
