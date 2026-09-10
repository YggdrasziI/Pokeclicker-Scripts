/**
 * @class The AutomationMaxRaid regroups the 'Max Raid Auto Fight' functionalities
 *
 * Galar's Max Raid dens are temporary battles the game opens by the day: ten of the thirty
 * dens are drawn every day, and each closes after a win until the next day. Every win gives
 * a Wishing Piece.
 */
class AutomationMaxRaid
{
    static Settings = { FeatureEnabled: "MaxRaid-RaidEnabled" };

    /**
     * @brief Builds the menu
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            // Hide the Max Raid panel by default
            const title = '<img src="assets/images/map/raidden.png" height="20px" style="position:relative; bottom: 3px;">'
                        +     '&nbsp;Max Raid&nbsp;'
                        + '<img src="assets/images/map/raidden.png" height="20px" style="position:relative; bottom: 3px;">';
            const panelContainer = Automation.Menu.addCategory("maxRaidButtons", title);
            this.__internal__maxRaidPanel = panelContainer.parentElement;
            this.__internal__maxRaidPanel.hidden = true;

            // Add an on/off button
            const autoRaidTooltip = "Starts the Max Raid dens open today, one after the other"
                                  + Automation.Menu.TooltipSeparator
                                  + "You are moved to the den's town first, so the map stays in step\n"
                                  + "with where the raid sends you back afterwards.\n"
                                  + "Every win gives a Wishing Piece. A den closes after one win a day,\n"
                                  + "unless the Infinite Max Raid script keeps it open: the open dens\n"
                                  + "are then cycled for as long as this is on"
                                  + Automation.Menu.TooltipSeparator
                                  + "⚠️ A raid lasts 60 seconds at most; losing one turns this off.\n"
                                  + "'Focus on' moves you around as well, turn it off first";
            const autoRaidButton =
                Automation.Menu.addAutomationButton("Auto Raid", this.Settings.FeatureEnabled, autoRaidTooltip, panelContainer, true);
            autoRaidButton.addEventListener("click", this.__internal__toggleAutoRaid.bind(this), false);

            // Disable the feature by default
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
        }
        else
        {
            // Set the div visibility watcher
            setInterval(this.__internal__updateDivVisibilityAndContent.bind(this), 1000); // Refresh every 1s
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__autoRaidLoop = null;
    static __internal__maxRaidPanel = null;

    // The den raided last, for the round-robin, and the one whose outcome is still to be read
    static __internal__lastRaidName = null;
    static __internal__pendingRaidName = null;

    // The questline step that opens the dens, built on first use: the game's requirement
    // classes are only there once the game is
    static __internal__densUnlockRequirement = null;

    /**
     * @brief Toggles the 'Auto Raid' feature
     *
     * If the feature was enabled and it's toggled to disabled, the loop will be stopped.
     * If the feature was disabled and it's toggled to enabled, the loop will be started.
     *
     * @param enable: [Optional] If a boolean is passed, it will be used to set the right state.
     *                Otherwise, the local storage value will be used
     */
    static __internal__toggleAutoRaid(enable)
    {
        // If we got the click event, use the button status
        if ((enable !== true) && (enable !== false))
        {
            enable = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        }

        if (enable)
        {
            // Only set a loop if there is none active
            if (this.__internal__autoRaidLoop === null)
            {
                // A raid lasts up to a minute, there is nothing to gain from checking more often
                this.__internal__autoRaidLoop = setInterval(this.__internal__autoRaidLoopCallback.bind(this), 1000); // Runs every second

                // Run the loop once immediately
                this.__internal__autoRaidLoopCallback();
            }
        }
        else
        {
            // Unregister the loop
            clearInterval(this.__internal__autoRaidLoop);
            this.__internal__autoRaidLoop = null;
            this.__internal__pendingRaidName = null;
        }
    }

    /**
     * @brief The 'Auto Raid' loop
     *
     * Reads the outcome of the raid started last, then starts the next open den from its town.
     * A lost raid turns the feature off; no open den leaves it waiting.
     */
    static __internal__autoRaidLoopCallback()
    {
        // Kill the loop if the menu is not visible anymore
        if (this.__internal__maxRaidPanel.hidden)
        {
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
            return;
        }

        // A raid is running, let it play out
        if (App.game.gameState === GameConstants.GameState.temporaryBattle)
        {
            return;
        }

        // The raid started last has ended. The game ends one on a win, or when the timer runs
        // below zero (TemporaryBattleRunner.tick), and only a loss leaves the timer there
        if (this.__internal__pendingRaidName !== null)
        {
            const endedRaidName = this.__internal__pendingRaidName;
            this.__internal__pendingRaidName = null;

            if (TemporaryBattleRunner.timeLeft() < 0)
            {
                Automation.Notifications.sendWarningNotif(`Not strong enough for ${endedRaidName}, turning off the automation`, "Max Raid");
                Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
                return;
            }
        }

        // Only start from a town or a route: never from inside a gym, a dungeon, the
        // Battle Frontier or the Safari, which the player or another feature is busy with
        if ((App.game.gameState !== GameConstants.GameState.town)
            && (App.game.gameState !== GameConstants.GameState.fighting))
        {
            return;
        }

        const den = this.__internal__pickNextDen(this.__internal__getOpenDens());
        if (den === null)
        {
            // Nothing open right now, or every den done for today: wait, like the Battle Café does
            return;
        }

        // The game sends the player back to the den's town whatever the outcome, without
        // touching the region: go there first, or the map ends up pointing somewhere else
        Automation.Utils.Route.moveToTown(den.optionalArgs.returnTown);
        if (!Automation.Utils.Route.isPlayerInTown(den.optionalArgs.returnTown))
        {
            return;
        }

        den.protectedOnclick();

        if (App.game.gameState === GameConstants.GameState.temporaryBattle)
        {
            this.__internal__lastRaidName = den.name;
            this.__internal__pendingRaidName = den.name;
            Automation.Notifications.sendNotif(`Started ${den.name}`, "Max Raid");
        }
    }

    /**
     * @brief Lists the dens that can be raided right now, in the game's order
     *
     * A den is open when the game shows it on the map (unlocked, drawn today and not done for
     * the day) and its town can be reached, since the raid is started from there.
     *
     * @returns The open dens
     */
    static __internal__getOpenDens()
    {
        return Object.values(TemporaryBattleList).filter(
            (battle) => (battle.optionalArgs?.displayName === "Max Raid")
                     && battle.isVisible()
                     && battle.isUnlocked()
                     && Automation.Utils.Route.canMoveToTown(TownList[battle.optionalArgs.returnTown]));
    }

    /**
     * @brief Picks the den to raid next among the given @p openDens
     *
     * Round-robin after the den raided last: without the Infinite Max Raid script a den drops
     * out of the list once won, with it the open dens are cycled evenly.
     *
     * @param openDens: The dens to choose from, see __internal__getOpenDens
     *
     * @returns The next den, or null if none is open
     */
    static __internal__pickNextDen(openDens)
    {
        if (openDens.length === 0)
        {
            return null;
        }

        const lastIndex = openDens.findIndex((battle) => battle.name === this.__internal__lastRaidName);
        return openDens[(lastIndex + 1) % openDens.length];
    }

    /**
     * @brief Toggle the 'Max Raid' category visibility based on the game state
     *
     * The category is only visible in Galar, once the questline has opened the dens
     */
    static __internal__updateDivVisibilityAndContent()
    {
        const isAvailable = (player.region === GameConstants.Region.galar) && this.__internal__areDensUnlocked();

        this.__internal__maxRaidPanel.hidden = !isAvailable;
        if (!isAvailable)
        {
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
        }
    }

    /**
     * @brief Checks whether the Max Raid dens have been opened by the questline
     *
     * The same step every den requires, see the 'Max Raid' entries of TemporaryBattleList.
     *
     * @returns True if the dens are unlocked, False otherwise
     */
    static __internal__areDensUnlocked()
    {
        if (this.__internal__densUnlockRequirement === null)
        {
            this.__internal__densUnlockRequirement = new QuestLineStepCompletedRequirement("The Lair of Giants", 2);
        }

        return this.__internal__densUnlockRequirement.isCompleted();
    }
}
