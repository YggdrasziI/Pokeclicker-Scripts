/**
 * @class The AutomationVitamins regroups the 'Auto Vitamins' functionalities
 *
 * Vitamins are handed out to bring the whole party up to a target, rather than pouring everything
 * into whichever pokémon happens to come first. The party is served in the order of a chosen
 * attribute, the highest Egg Steps first by default, since those are the pokémon a Carbos
 * shortens the most; among equals, the pokémon furthest from the target comes first.
 *
 * @note The menu is hidden until the player can actually buy a vitamin
 */
class AutomationVitamins
{
    static Settings = {
                          FeatureEnabled: "Vitamins-Enabled",
                          PrioritizedSorting: "Vitamins-PrioritizedSorting",
                          PrioritizedSortingDescending: "Vitamins-PrioritizedSortingDescending",
                          // One target per vitamin type, in the GameConstants.VitaminType order
                          Target: function(vitaminName) { return `Vitamins-${vitaminName}-Target`; }
                      };

    /**
     * @brief Builds the menu, and restores the previous running state if needed
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            // Highest Egg Steps first: the slowest breeders are the ones a vitamin helps the most
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.PrioritizedSorting, SortOptions.eggCycles);
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.PrioritizedSortingDescending, true);

            this.__internal__buildMenu();
        }
        else if (initStep == Automation.InitSteps.Finalize)
        {
            // Restore previous session state
            this.__internal__toggleAutoVitamins();
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__vitaminsContainer = null;
    static __internal__autoVitaminsLoop = null;

    /**
     * @brief Builds the menu
     */
    static __internal__buildMenu()
    {
        this.__internal__vitaminsContainer = document.createElement("div");
        Automation.Menu.AutomationButtonsDiv.appendChild(this.__internal__vitaminsContainer);

        Automation.Menu.addSeparator(this.__internal__vitaminsContainer);

        // Only display the menu when the mechanic is available
        this.__internal__vitaminsContainer.hidden = !this.__internal__isVitaminMechanicAvailable();

        const titleDiv = Automation.Menu.createTitleElement("Auto Vitamins");
        this.__internal__vitaminsContainer.appendChild(titleDiv);

        const tooltip = "Hands out vitamins until every pokémon reaches the targets below"
                      + Automation.Menu.TooltipSeparator
                      + "The party is served in the order of the 'Prioritize' attribute below,\n"
                      + "the highest Egg Steps first by default. Among equals, the pokémon\n"
                      + "furthest from the target comes first\n"
                      + "A target of 0 leaves that vitamin alone. Nothing is ever removed"
                      + Automation.Menu.TooltipSeparator
                      + "⚠️ The game caps the total vitamins per pokémon at\n"
                      + "5 per region reached, all three types combined";
        const featureButton =
            Automation.Menu.addAutomationButton("Vitamins", this.Settings.FeatureEnabled, tooltip, this.__internal__vitaminsContainer, true);
        featureButton.addEventListener("click", this.__internal__toggleAutoVitamins.bind(this), false);

        // Build the advanced settings panel
        const settingPanel = Automation.Menu.addSettingPanel(featureButton.parentElement.parentElement);
        settingPanel.style.textAlign = "right";

        const settingTitle = Automation.Menu.createTitleElement("Vitamins advanced settings");
        settingTitle.style.marginBottom = "10px";
        settingPanel.appendChild(settingTitle);

        settingPanel.appendChild(this.__internal__buildSortingSelectorList());

        for (const vitaminName of this.__internal__getVitaminNames())
        {
            this.__internal__addTargetSetting(settingPanel, vitaminName);
        }

        if (this.__internal__vitaminsContainer.hidden)
        {
            this.__internal__setVitaminUnlockWatcher();
        }
    }

    /**
     * @brief Builds the priority selector drop-down list, with its sort direction button
     *
     * Same widget as the hatchery's 'Sorting on attribute' row, over the game's own party
     * sort attributes.
     *
     * @returns the created element
     */
    static __internal__buildSortingSelectorList()
    {
        const container = document.createElement("div");
        container.style.paddingLeft = "10px";
        container.style.paddingRight = "10px";

        // Set the tooltip
        const baseTooltip = "Which pokémon get their vitamins first when the stock runs short"
                          + Automation.Menu.TooltipSeparator
                          + "It uses the same attributes as the sorting in the Day Care.\n"
                          + "Egg Steps, highest first, by default: a Carbos shortens the\n"
                          + "slowest breeders the most. Among equals, the pokémon furthest\n"
                          + "from the target comes first";

        const isDescending = Automation.Utils.LocalStorage.getValue(this.Settings.PrioritizedSortingDescending) === "true";
        const tooltip = baseTooltip
                      + Automation.Menu.TooltipSeparator
                      + "Sorting direction: " + (isDescending ? "Descending (highest value first)" : "Ascending (lowest value first)");
        container.classList.add("hasAutomationTooltip");
        container.setAttribute("automation-tooltip-text", tooltip);

        // Add the label
        container.appendChild(document.createTextNode("Prioritize on attribute:"));

        // Add the drop-down list
        const selectElem = Automation.Menu.createDropDownListElement("selectedSorting-Vitamins");
        selectElem.style.position = "relative";
        selectElem.style.bottom = "2px";
        selectElem.style.width = "85px";
        selectElem.style.marginLeft = "4px";
        selectElem.style.paddingLeft = "3px";
        selectElem.style.borderTopRightRadius = "0px";
        selectElem.style.borderBottomRightRadius = "0px";
        container.appendChild(selectElem);

        const previouslySelectedType = Automation.Utils.LocalStorage.getValue(this.Settings.PrioritizedSorting);

        // Populate the list
        for (const sortType in SortOptionConfigs)
        {
            const opt = document.createElement("option");
            opt.textContent = SortOptionConfigs[sortType].text;
            opt.value = sortType;
            opt.id = `selectedSorting-Vitamins-${sortType}`;

            // Restore the previously selected item
            if (sortType == previouslySelectedType)
            {
                opt.selected = true;
            }

            selectElem.options.add(opt);
        }

        // Update the local storage if the value is changed by the user
        selectElem.onchange = function()
            {
                Automation.Utils.LocalStorage.setValue(this.Settings.PrioritizedSorting, selectElem.value);
            }.bind(this);

        // Add the sort direction button
        const sortDirectionElem = Automation.Menu.createSortDirectionButtonElement(this.Settings.PrioritizedSortingDescending);
        // Update the tooltip on sort change
        sortDirectionElem.input.addEventListener("click", function()
            {
                const isDescending = sortDirectionElem.input.checked;
                const newTooltip = baseTooltip
                                 + Automation.Menu.TooltipSeparator
                                 + "Sorting direction: " + (isDescending ? "Descending (highest value first)" : "Ascending (lowest value first)");
                container.setAttribute("automation-tooltip-text", newTooltip);
            }, false);
        sortDirectionElem.container.style.borderTopRightRadius = "5px";
        sortDirectionElem.container.style.borderBottomRightRadius = "5px";
        container.appendChild(sortDirectionElem.container);

        return container;
    }

    /**
     * @brief Adds the per-pokémon target input for the given @p vitaminName
     *
     * @param {Element} parent: The settings panel to add the input to
     * @param {string} vitaminName: The vitamin name, as the game spells it
     */
    static __internal__addTargetSetting(parent, vitaminName)
    {
        const setting = this.Settings.Target(vitaminName);

        // Opt-in: an automation that starts spending the player's vitamins on its own would be
        // hard to undo, since removing them one pokémon at a time is entirely manual
        Automation.Utils.LocalStorage.setDefaultValue(setting, 0);

        const container = document.createElement("div");
        container.style.marginTop = "5px";
        container.style.paddingRight = "10px";
        parent.appendChild(container);

        const label = document.createElement("span");
        label.innerHTML = `<img src="assets/images/items/vitamin/${vitaminName}.png" height="20px"`
                        + ` style="position: relative; bottom: 3px; image-rendering: pixelated;">`
                        + `&nbsp;${vitaminName} per pokémon:`;
        container.appendChild(label);

        const input = Automation.Menu.createTextInputElement(3, "[0-9]");
        input.id = setting;
        input.textContent = Automation.Utils.LocalStorage.getValue(setting);
        input.style.display = "inline-block";
        input.style.width = "45px";
        input.style.marginLeft = "5px";
        container.appendChild(input);

        input.oninput = function()
            {
                Automation.Utils.LocalStorage.setValue(setting, input.textContent.trim());
            };
    }

    /**
     * @brief Watches for the in-game functionality to be unlocked.
     *        Once unlocked, the menu will be displayed to the user
     */
    static __internal__setVitaminUnlockWatcher()
    {
        const watcher = setInterval(function()
            {
                if (this.__internal__isVitaminMechanicAvailable())
                {
                    clearInterval(watcher);
                    this.__internal__vitaminsContainer.hidden = false;
                }
            }.bind(this), 10000); // Check every 10 seconds
    }

    /**
     * @brief Toggles the 'Auto Vitamins' feature
     *
     * @param enable: [Optional] If a boolean is passed, it will be used to set the right state.
     *                Otherwise, the local storage value will be used
     */
    static __internal__toggleAutoVitamins(enable)
    {
        if ((enable !== true) && (enable !== false))
        {
            enable = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        }

        if (enable)
        {
            if (this.__internal__autoVitaminsLoop === null)
            {
                // Vitamin stocks move slowly, there is nothing to gain from checking often
                this.__internal__autoVitaminsLoop = setInterval(this.__internal__vitaminsLoop.bind(this), 10000);
                this.__internal__vitaminsLoop();
            }
        }
        else
        {
            clearInterval(this.__internal__autoVitaminsLoop);
            this.__internal__autoVitaminsLoop = null;
        }
    }

    /**
     * @brief The 'Auto Vitamins' loop
     *
     * Every vitamin type with a target above zero is distributed over the party, the pokémon
     * furthest from the target first.
     */
    static __internal__vitaminsLoop()
    {
        // useVitamin notifies on every refusal, so the challenge is checked here rather than
        // letting the game turn a disabled mechanic into a stream of warnings
        if (App.game.challenges.list.disableVitamins.active())
        {
            return;
        }

        for (const [ vitaminType, vitaminName ] of this.__internal__getVitaminNames().entries())
        {
            const target = Automation.Utils.tryParseInt(
                Automation.Utils.LocalStorage.getValue(this.Settings.Target(vitaminName)), 0);

            if (target <= 0)
            {
                continue;
            }

            this.__internal__distributeVitamin(vitaminType, vitaminName, target);
        }
    }

    /**
     * @brief Brings as many pokémon as the stock allows up to the given @p target
     *
     * @param vitaminType: The GameConstants.VitaminType to hand out
     * @param {string} vitaminName: The matching item name, used to read the player's stock
     * @param {number} target: The per-pokémon amount to reach
     */
    static __internal__distributeVitamin(vitaminType, vitaminName, target)
    {
        let remainingStock = player.itemList[vitaminName]();

        if (remainingStock <= 0)
        {
            return;
        }

        // A pokémon in the hatchery or the queue refuses vitamins with a warning notification,
        // and one that reached the total cap cannot take any more of any type
        const candidates = App.game.party.caughtPokemon.filter(
            (pokemon) => !pokemon.breeding
                      && (pokemon.vitaminsUsed[vitaminType]() < target)
                      && (pokemon.vitaminUsesRemaining() > 0));

        // The chosen attribute first, then furthest from the target, so a short stock goes to
        // the pokémon the player cares about instead of whichever comes first in the party order
        const compareByAttribute = this.__internal__getAttributeComparator();
        candidates.sort((a, b) => compareByAttribute(a, b)
                                || (a.vitaminsUsed[vitaminType]() - b.vitaminsUsed[vitaminType]()));

        let usedTotal = 0;

        for (const pokemon of candidates)
        {
            if (remainingStock <= 0)
            {
                break;
            }

            const amount = Math.min(target - pokemon.vitaminsUsed[vitaminType](),
                                    pokemon.vitaminUsesRemaining(),
                                    remainingStock);

            if (amount <= 0)
            {
                continue;
            }

            pokemon.useVitamin(vitaminType, amount);

            remainingStock -= amount;
            usedTotal += amount;
        }

        if (usedTotal > 0)
        {
            Automation.Notifications.sendNotif(
                `Gave ${usedTotal.toLocaleString('en-US')} ${vitaminName} to ${candidates.length} pokémon`, "Vitamins");
        }
    }

    /**
     * @brief Builds the comparator for the 'Prioritize on attribute' setting
     *
     * Attribute values are compared as-is, so names sort as well as numbers, and the
     * direction setting flips the result. An unknown attribute compares everything equal,
     * which leaves the furthest-from-target tie-break in charge.
     *
     * @returns The comparator function
     */
    static __internal__getAttributeComparator()
    {
        const sortAttribute = parseInt(Automation.Utils.LocalStorage.getValue(this.Settings.PrioritizedSorting));
        const isDescending = Automation.Utils.LocalStorage.getValue(this.Settings.PrioritizedSortingDescending) === "true";
        const getValue = SortOptionConfigs[sortAttribute]?.getValue;

        if (typeof getValue !== "function")
        {
            return () => 0;
        }

        return function(a, b)
            {
                const aValue = getValue(a);
                const bValue = getValue(b);
                const result = (aValue > bValue) ? 1 : ((aValue < bValue) ? -1 : 0);
                return isDescending ? -result : result;
            };
    }

    /**
     * @brief Lists the vitamin names, indexed by their GameConstants.VitaminType value
     *
     * The game uses that name for the item, its image and the player's inventory key alike.
     *
     * @returns An array of vitamin names
     */
    static __internal__getVitaminNames()
    {
        return Object.keys(GameConstants.VitaminType).filter((key) => isNaN(key));
    }

    /**
     * @brief Checks whether the player can use vitamins at all
     *
     * @returns True if the mechanic is available, False otherwise
     */
    static __internal__isVitaminMechanicAvailable()
    {
        return !App.game.challenges.list.disableVitamins.active()
            && (App.game.party.caughtPokemon.length > 0);
    }
}
