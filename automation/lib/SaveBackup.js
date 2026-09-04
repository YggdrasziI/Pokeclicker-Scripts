/**
 * @class The AutomationSaveBackup writes save backups to disk on a schedule.
 *
 * The game already saves to local storage every ten seconds; what it never does on its own is
 * put a copy somewhere that survives the browser profile. Its 'Save Reminder' only nags you to
 * press the download button yourself, which is precisely the kind of chore this project exists
 * to remove.
 *
 * A page cannot write files, so the work is split: this class decides *when* a backup is due and
 * hands over its contents, and the desktop client writes the file and prunes old ones. Outside
 * the desktop client there is nothing to write to, so the feature hides itself.
 */
class AutomationSaveBackup
{
    static Settings = {
                          FeatureEnabled: "SaveBackup-Enabled",
                          IntervalMinutes: "SaveBackup-IntervalMinutes",
                          Retention: "SaveBackup-Retention"
                      };

    /**
     * @brief Builds the menu and exposes the collection hook the desktop client calls
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        if (initStep == Automation.InitSteps.BuildMenu)
        {
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.IntervalMinutes, 30);
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.Retention, 10);

            this.__internal__buildMenu();
        }
        else
        {
            // The desktop client polls this from the main process
            window.AutomationSaveBackup = this;
        }
    }

    /**
     * @brief Hands a backup over to the desktop client, if one is due
     *
     * Called from the client's main process, which owns the filesystem. Returns null when
     * nothing needs writing, so the common case costs a single property read.
     *
     * @returns { filename, contents, retention } or null
     */
    static collect()
    {
        if (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) !== "true")
        {
            return null;
        }

        const intervalMinutes = Automation.Utils.tryParseInt(
            Automation.Utils.LocalStorage.getValue(this.Settings.IntervalMinutes), 30);
        if (intervalMinutes <= 0)
        {
            return null;
        }

        const now = Date.now();
        if ((this.__internal__lastBackup !== null)
            && ((now - this.__internal__lastBackup) < (intervalMinutes * 60 * 1000)))
        {
            return null;
        }
        this.__internal__lastBackup = now;

        let contents;
        try
        {
            contents = SaveSelector.btoa(JSON.stringify({
                                                            player: player,
                                                            save: Save.getSaveObject(),
                                                            settings: Settings.toJSON()
                                                        }));
        }
        catch (e)
        {
            console.error("Automation: could not build the save backup", e);
            return null;
        }

        // Tell the game a backup exists, which is also what silences its Save Reminder
        App.game.saveReminder.lastDownloaded(App.game.statistics.secondsPlayed());

        return {
                   filename: this.__internal__buildFileName(),
                   contents: contents,
                   retention: Automation.Utils.tryParseInt(
                       Automation.Utils.LocalStorage.getValue(this.Settings.Retention), 10)
               };
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__lastBackup = null;

    /**
     * @brief Names the file after the trainer and the moment it was taken
     *
     * Sortable by name, and distinct per profile, so several saves can share one folder.
     */
    static __internal__buildFileName()
    {
        const profile = Save.getSaveObject()?.profile?.name ?? "Trainer";
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "h");
        // Keep it filesystem-safe, profile names are free text
        const safeProfile = profile.replace(/[^\w \-.]/g, "_");
        return `${safeProfile} ${stamp} [v${App.game.update.version}].txt`;
    }

    /**
     * @brief Adds the feature to the card, unless we are not in the desktop client
     */
    static __internal__buildMenu()
    {
        if (!App.isUsingClient)
        {
            // Only the desktop client can write files
            return;
        }

        // Its own section rather than a row among the automation features: this is about the
        // client rather than the game, and the interval is the whole point of the feature, so
        // burying it behind an 'Advanced settings' disclosure made it impossible to find.
        const container = Automation.Menu.addCategory("automationSaveBackup", "Save backups");

        const tooltip = "Writes a copy of your save to disk at a regular interval"
                      + Automation.Menu.TooltipSeparator
                      + "The game already saves to local storage on its own, but that copy is lost\n"
                      + "with the browser profile. Backups land in the client's 'save-backups' folder,\n"
                      + "and this also silences the in-game save reminder";
        Automation.Menu.addAutomationButton("Enabled", this.Settings.FeatureEnabled, tooltip, container);

        this.__internal__addNumberSetting(container, "Every (minutes):", this.Settings.IntervalMinutes, 4);
        this.__internal__addNumberSetting(container, "Backups to keep:", this.Settings.Retention, 3);
    }

    /**
     * @brief Adds a labeled numeric input bound to the @p setting
     */
    static __internal__addNumberSetting(parent, label, setting, charLimit)
    {
        const container = document.createElement("div");
        container.style.textAlign = "right";
        container.style.marginTop = "5px";
        container.style.paddingRight = "10px";
        parent.appendChild(container);

        container.appendChild(document.createTextNode(label));

        const input = Automation.Menu.createTextInputElement(charLimit, "[0-9]");
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
}
