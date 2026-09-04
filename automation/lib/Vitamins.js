/**
 * @class The AutomationVitamins regroups the 'Auto Vitamins' functionalities
 *
 * Vitamins are handed out to bring the whole party up to a target, rather than pouring everything
 * into whichever pokémon happens to come first. The pokémon furthest from the target are served
 * first, so a short stock spreads instead of maxing out a handful of them.
 *
 * @note The menu is hidden until the player can actually buy a vitamin
 */
class AutomationVitamins
{
    static Settings = {
                          FeatureEnabled: "Vitamins-Enabled",
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
                      + "The pokémon furthest from a target are served first, so a short\n"
                      + "stock spreads over the party instead of maxing out a few of them\n"
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

        // Furthest from the target first, so a short stock levels the party instead of maxing
        // out whichever pokémon happens to come first in the party order
        candidates.sort((a, b) => a.vitaminsUsed[vitaminType]() - b.vitaminsUsed[vitaminType]());

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
