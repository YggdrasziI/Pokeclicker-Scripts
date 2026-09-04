/**
 * @brief The automation main class
 */
class Automation
{
    // Aliases on the other classes so every calls in the code can use the `Automation.<Alias>` form
    static BattleCafe = AutomationBattleCafe;
    static BattleFrontier = AutomationBattleFrontier;
    static Dungeon = AutomationDungeon;
    static Gym = AutomationGym;
    static Safari = AutomationSafari;

    static Click = AutomationClick;
    static Farm = AutomationFarm;
    static Focus = AutomationFocus;
    static Hatchery = AutomationHatchery;
    static Items = AutomationItems;
    static Notifications = AutomationNotifications;
    static Menu = AutomationMenu;
    static Shop = AutomationShop;
    static Trivia = AutomationTrivia;
    static Underground = AutomationUnderground;
    static Utils = AutomationUtils;
    static ClickStats = AutomationClickStats;
    static SaveBackup = AutomationSaveBackup;
    static Bridges = AutomationBridges;
    static EpheniaControls = AutomationEpheniaControls;

    static InitSteps = class AutomationInitSteps
    {
        static BuildMenu = 0;
        static Finalize = 1;
    };

    /**************************/
    /*    PUBLIC INTERFACE    */
    /**************************/

    /**
     * @brief Automation entry point
     *
     * @param {boolean} disableFeaturesByDefault: True if every features needs to be disabled by default, False otherwise
     * @param {boolean} disableSettingsByDefault: True if every settings needs to be disabled by default, False otherwise
     */
    static start(disableFeaturesByDefault, disableSettingsByDefault)
    {
        this.Menu.DisableFeaturesByDefault = disableFeaturesByDefault;
        this.Menu.DisableSettingsByDefault = disableSettingsByDefault;

        var timer = setInterval(function()
        {
            // Check if the game window has loaded
            if (!document.getElementById("game").classList.contains("loading"))
            {
                clearInterval(timer);

                // Log automation start
                console.log(`[${GameConstants.formatDate(new Date())}] %cStarting automation..`, "color:#8e44ad;font-weight:900;");

                for (let initKey in this.InitSteps)
                {
                    let initStep = this.InitSteps[initKey];

                    this.Utils.initialize(initStep);
                    this.Menu.initialize(initStep);

                    // Then add the main menu
                    this.Menu.addMainAutomationPanel(initStep);

                    // 'Automation' panel
                    //
                    // Focus orchestrates the other modules -- it drives Click, Gym, Dungeon,
                    // Farm, Hatchery, Underground and BattleFrontier directly -- so the whole
                    // stack has to be initialized for it to work at all.
                    this.Click.initialize(initStep);
                    // Measures how well the auto attack is keeping up
                    this.ClickStats.initialize(initStep);
                    this.Focus.initialize(initStep);
                    this.Hatchery.initialize(initStep);
                    this.Underground.initialize(initStep);
                    this.Farm.initialize(initStep);
                    this.Shop.initialize(initStep);
                    this.Items.initialize(initStep);
                    this.Notifications.initialize(initStep);
                    this.SaveBackup.initialize(initStep);

                    // 'Trivia' panel
                    this.Trivia.initialize(initStep);

                    // 'Gym', 'Dungeon' and 'Battle Frontier' instances panels
                    this.Gym.initialize(initStep);
                    this.Dungeon.initialize(initStep);
                    this.BattleFrontier.initialize(initStep);

                    // Safari is left out on purpose: nothing else depends on it, and Ephenia's
                    // autosafarizone covers it with better pathfinding and uncaught/contagious hunting.
                    // this.Safari.initialize(initStep);

                    // Floating panel
                    this.BattleCafe.initialize(initStep);

                    // Keeps this automation and the Ephenia userscripts from running
                    // incompatible features at the same time
                    this.Bridges.initialize(initStep);

                    // Mirrors the Ephenia scripts' main switches into the card
                    this.EpheniaControls.initialize(initStep);

                    // Every module has dropped its controls in by now, so they can be
                    // wrapped into foldable sections
                    if (initStep == this.InitSteps.Finalize)
                    {
                        this.Menu.buildFeatureGroups();
                    }
                }

                // Log automation startup completion
                console.log(`[${GameConstants.formatDate(new Date())}] %cAutomation started`, "color:#2ecc71;font-weight:900;");
            }
        }.bind(this), 200); // Try to instanciate every 0.2s
    }
}
