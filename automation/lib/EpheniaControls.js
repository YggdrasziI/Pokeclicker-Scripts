/**
 * @class The AutomationEpheniaControls gathers the Ephenia userscripts' main switches into the
 *        Automation card.
 *
 * Those scripts each inject their controls into the game screen they act on: the auto mine sits
 * in the Underground modal, the hatchery on the breeding card, the farmer in the farm modal...
 * Handy while you are already there, tedious when you just want to flip something on.
 *
 * The main switches are mirrored rather than moved: each row reflects the state of the real
 * button and clicks it when used, so the original controls keep working and, because the real
 * button is what gets clicked, @see AutomationBridges still gets its say about conflicts.
 *
 * The settings tables, on the other hand, are moved outright. They live in a tab of the in-game
 * settings modal, which is exactly the round trip this is meant to remove, and moving the
 * elements keeps their handlers intact.
 */
class AutomationEpheniaControls
{
    /**
     * @brief The switches worth surfacing, grouped by script
     *
     * Deliberately only the main ones. Settings that only make sense while looking at the screen
     * they belong to (which berry to plant, which chest tier to open) are better left in place.
     */
    static Scripts = [
        {
            name: "Auto Clicker",
            toggles: [ { id: "auto-click-start", label: "Click" },
                       { id: "auto-gym-start", label: "Gym" },
                       { id: "auto-dungeon-start", label: "Dungeon" } ]
        },
        {
            name: "Auto Mine",
            toggles: [ { id: "auto-mine-start", label: "Mine" },
                       { id: "auto-sell-treasure", label: "Sell treasure" } ]
        },
        {
            name: "Auto Hatchery",
            toggles: [ { id: "auto-hatch-start", label: "Hatch" },
                       { id: "auto-egg", label: "Eggs" },
                       { id: "auto-fossil", label: "Fossils" } ]
        },
        {
            name: "Auto Farmer",
            toggles: [ { id: "auto-plant-toggle", label: "Plant" },
                       { id: "auto-harvest-toggle", label: "Harvest" },
                       { id: "auto-replant-toggle", label: "Replant" },
                       { id: "auto-mulch-toggle", label: "Mulch" } ]
        },
        {
            name: "Other scripts",
            toggles: [ { id: "toggle-auto-quest", label: "Auto Quest" },
                       { id: "auto-battle-items", label: "Battle Items" },
                       { id: "auto-safari-toggle", label: "Auto Safari" } ]
        }
    ];

    // Dropdowns those scripts drop onto the town map instead of registering as settings, so they
    // are neither mirrorable as buttons nor picked up by the settings relocation
    static WorldMapSelects = [
        { id: "change-time-select", label: "In-game hour" },
        { id: "change-weather-select", label: "Weather" }
    ];

    /**
     * @brief Builds the category, if any of the mirrored scripts is running
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        // The Ephenia scripts build their buttons from their own initializers, which have all run
        // by the time this step is reached
        if (initStep != Automation.InitSteps.Finalize) return;

        this.__internal__buildMenu();
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__observer = null;

    /**
     * @brief Adds one row per available switch, grouped by script
     */
    static __internal__buildMenu()
    {
        const available = this.Scripts
            .map((script) => ({ name: script.name,
                                toggles: script.toggles.filter((t) => document.getElementById(t.id) != null) }))
            .filter((script) => script.toggles.length > 0);

        const availableSelects = this.WorldMapSelects.filter((entry) => document.getElementById(entry.id) != null);

        if ((available.length === 0) && (availableSelects.length === 0))
        {
            // None of those scripts is installed, don't add an empty category
            return;
        }

        // Its own card, so it can be collapsed, moved and found independently of the automation
        const cardBody = Automation.Menu.createCard("epheniaDisplayContainer", "Ephenia scripts");
        if (cardBody == null)
        {
            return;
        }

        for (const script of available)
        {
            const container = Automation.Menu.addCategory(
                `epheniaControls-${script.name.replace(/[^\w]/g, "")}`, script.name, cardBody);

            for (const toggle of script.toggles)
            {
                this.__internal__addMirrorButton(container, toggle);
            }
        }

        this.__internal__relocateWorldMapSelects(cardBody, availableSelects);

        this.__internal__relocateScriptSettings(cardBody);
    }

    /**
     * @brief Moves the world map dropdowns of the given @p selects into the card
     *
     * The weather and time scripts drop their selector straight onto the town map, absolutely
     * positioned in a corner, which means the controls only exist while the map is on screen and
     * are spread across it. They are moved, not mirrored: the elements keep their own listeners,
     * so each script carries on working with no idea it was rehoused, and still works on its own
     * when this bundle is not installed.
     *
     * @param {Element} cardBody: The Ephenia card body to move the dropdowns into
     * @param selects: The WorldMapSelects entries that were found in the page
     */
    static __internal__relocateWorldMapSelects(cardBody, selects)
    {
        if (selects.length === 0)
        {
            return;
        }

        const container = Automation.Menu.addCategory("epheniaControls-TimeAndWeather", "Time and weather", cardBody);

        for (const entry of selects)
        {
            const source = document.getElementById(entry.id);

            // Same DOM shape as the mirrored buttons, so the rows line up with the rest of the card
            const rowContainer = document.createElement("span");
            container.appendChild(rowContainer);

            const row = document.createElement("div");
            row.style.paddingLeft = "10px";
            row.style.paddingRight = "10px";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            rowContainer.appendChild(row);

            const label = document.createElement("span");
            label.textContent = `${entry.label} :`;
            row.appendChild(label);

            // Inline styles beat the id rule those scripts install, which pins the dropdown to a
            // corner of the town map
            source.style.position = "static";
            source.style.right = "unset";
            source.style.top = "unset";
            source.style.height = "auto";
            source.style.width = "auto";
            source.style.fontSize = "inherit";

            row.appendChild(source);
        }
    }

    /**
     * @brief Moves each script's settings table out of the Settings modal and into the card
     *
     * Those scripts register their settings in a 'Scripts' tab of the in-game settings, which
     * means leaving the game screen and hunting through a modal to change anything. The tables
     * are moved rather than mirrored: the elements keep their own event handlers, so the owning
     * script carries on working with no idea it was rehoused.
     *
     * The desktop client's own settings (which scripts to run, auto-updates) are deliberately
     * left behind: they live in a separate table outside this container, and the client's
     * documentation points people at the settings menu for them.
     *
     * @param {Element} cardBody: The Ephenia card body to move the settings into
     */
    static __internal__relocateScriptSettings(cardBody)
    {
        const settingsContainer = document.getElementById("settings-scripts-container");
        if (settingsContainer == null)
        {
            return;
        }

        // Snapshot, the tables get reparented as we go
        for (const table of [ ...settingsContainer.children ])
        {
            const heading = table.querySelector("thead th");
            const name = heading ? heading.textContent.trim() : null;
            if (!name)
            {
                continue;
            }

            const categoryId = `epheniaSettings-${name.replace(/[^\w]/g, "")}`;
            const container = Automation.Menu.addCategory(categoryId, `${name} settings`, cardBody);

            // The heading is now the category title, showing it twice would be noise
            heading.closest("thead")?.remove();
            container.appendChild(table);
        }
    }

    /**
     * @brief Adds a button mirroring the Ephenia button of the given @p toggle
     *
     * The DOM shape matches the one @see Automation.Menu.addAutomationButton produces, so the
     * rows line up with the rest of the card.
     *
     * @param {Element} container: The category content div
     * @param {Object} toggle: The { id, label } pair to mirror
     */
    static __internal__addMirrorButton(container, toggle)
    {
        const source = document.getElementById(toggle.id);

        const buttonMainContainer = document.createElement("span");
        container.appendChild(buttonMainContainer);
        const buttonContainer = document.createElement("div");
        buttonContainer.style.paddingLeft = "10px";
        buttonContainer.style.paddingRight = "10px";
        buttonMainContainer.appendChild(buttonContainer);

        const label = document.createElement("span");
        label.innerHTML = `${toggle.label} : `;
        buttonContainer.appendChild(label);

        const mirror = Automation.Menu.createButtonElement(`ephenia-mirror-${toggle.id}`);
        buttonContainer.appendChild(mirror);

        // Clicking the real button keeps the owning script's state, storage and label in sync,
        // and lets the conflict bridge intercept it
        mirror.onclick = function() { source.click(); };

        this.__internal__syncMirror(mirror, source);
        this.__internal__watchSource(mirror, source);
    }

    /**
     * @brief Copies the source button's on/off state onto its mirror
     */
    static __internal__syncMirror(mirror, source)
    {
        const isEnabled = source.classList.contains("btn-success");

        mirror.textContent = isEnabled ? "On" : "Off";
        mirror.classList.remove(isEnabled ? "btn-danger" : "btn-success");
        mirror.classList.add(isEnabled ? "btn-success" : "btn-danger");
    }

    /**
     * @brief Keeps the mirror in step when the feature is toggled from its original control,
     *        or turned off by the conflict bridge
     */
    static __internal__watchSource(mirror, source)
    {
        const observer = new MutationObserver(function()
            {
                AutomationEpheniaControls.__internal__syncMirror(mirror, source);
            });
        observer.observe(source, { attributes: true, attributeFilter: [ "class" ] });
    }
}
