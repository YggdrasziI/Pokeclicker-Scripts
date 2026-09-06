// ==UserScript==
// @name          [Pokeclicker] Custom Achievements
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Lets other scripts add achievements to the game's own Achievements window, in their own categories with their own achievement bonus, without touching the game's achievements. Ships no achievement by itself: scripts such as Shiny Variants register theirs through it.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.0.1

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/customachievements.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/customachievements.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// How another script adds achievements, whatever the order the scripts load in:
//
//   (window.CustomAchievementsQueue = window.CustomAchievementsQueue ?? []).push(() => [
//       {
//           name: 'Berry Baron',                       // unique, shown in the window and saved by name
//           description: 'Harvest 1,000 berries.',
//           progress: () => App.game.statistics.totalBerriesHarvested(),
//           amount: 1000,                              // the achievement completes at progress >= amount
//           bonus: 0.5,                                // weight inside its category, like the game's own
//           category: { name: 'farmingExtras', displayName: 'Farming Extras', bonus: 25 },
//           // optional:
//           hint: '1,000 berries need to be harvested.',
//           type: GameConstants.AchievementType.Farming,   // for the Type filter, default None
//           series: 'berries',                          // tiers sharing a series chain in the tracker
//           achievable: () => App.game.farming.canAccess(), // hidden and weightless while false
//           requirement: someAchievementRequirement,    // instead of progress/amount/hint/type
//       },
//   ]);
//
// The queue takes definitions or functions returning them; functions run once the
// game builds its achievement list, so they may use anything of the game. A
// category is given by name ('kanto', 'global', ... for the game's own, which
// dilutes their bonus) or by an object, which creates a category of its own with
// its own bonus percentage, unlocked by 'isUnlocked' (default: always).
// CustomAchievements.register(definition) does the same, and also works once the
// game runs.
class CustomAchievements {
    static SETTING_BONUS = 'customAchievementsBonus';

    static categories = new Map();
    static achievements = [];
    static bonusEnabled = null;
    static gameReady = false;

    static windowObject() {
        return !App.isUsingClient ? unsafeWindow : window;
    }

    // ---------------------------------------------------------------------------------
    // API
    // ---------------------------------------------------------------------------------

    static register(definition) {
        if (this.gameReady) {
            this.addDefinitions([definition]);
        } else {
            this.queue().push(definition);
        }
    }

    static queue() {
        const windowObject = this.windowObject();
        windowObject.CustomAchievementsQueue = windowObject.CustomAchievementsQueue ?? [];
        return windowObject.CustomAchievementsQueue;
    }

    // ---------------------------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------------------------

    static category(spec) {
        if (typeof spec === 'string') {
            const own = this.categories.get(spec);
            if (own) {
                return own.category;
            }
            const gameCategory = AchievementHandler.getAchievementCategories().find((c) => c.name === spec);
            if (!gameCategory) {
                throw new Error(`Custom Achievements: unknown category '${spec}'`);
            }
            return gameCategory;
        }
        if (!spec?.name) {
            throw new Error('Custom Achievements: a category needs a name');
        }
        if (!this.categories.has(spec.name)) {
            const bonus = Number(spec.bonus) || 0;
            const category = new AchievementCategory(spec.name, this.bonusEnabled() ? bonus : 0, spec.isUnlocked ?? (() => true));
            this.categories.set(spec.name, { category, bonus, displayName: spec.displayName ?? spec.name });
            AchievementHandler.getAchievementCategories().push(category);
            // The Category filter of the Achievements window lists the setting's options
            const filter = Settings.getSetting('achievementsCategory');
            if (!filter.options.some((option) => option.value === spec.name)) {
                filter.options.push(new SettingOption(spec.displayName ?? spec.name, spec.name));
            }
        }
        return this.categories.get(spec.name).category;
    }

    static applyBonusSetting() {
        this.categories.forEach(({ category, bonus }) => {
            category.achievementBonus = this.bonusEnabled() ? bonus : 0;
        });
        if (this.gameReady) {
            AchievementHandler.calculateMaxBonus();
        }
    }

    // ---------------------------------------------------------------------------------
    // Achievements
    // ---------------------------------------------------------------------------------

    static requirementFor(definition) {
        if (definition.requirement) {
            return definition.requirement;
        }
        if (typeof definition.progress !== 'function' || !(Number(definition.amount) > 0)) {
            throw new Error(`Custom Achievements: '${definition.name}' needs a requirement, or progress and amount`);
        }
        return new this.Requirement(definition);
    }

    static addDefinitions(definitions) {
        if (!definitions.length) {
            return;
        }
        definitions.flatMap((entry) => {
            const resolved = typeof entry === 'function' ? entry() : entry;
            return Array.isArray(resolved) ? resolved : [resolved];
        }).forEach((definition) => {
            if (!definition?.name || !definition.description) {
                throw new Error('Custom Achievements: an achievement needs a name and a description');
            }
            if (AchievementHandler.achievementList.some((a) => a.name === definition.name)) {
                console.warn(`Custom Achievements: '${definition.name}' already exists, skipped`);
                return;
            }
            const category = this.category(definition.category ?? { name: 'custom', displayName: 'Custom', bonus: 0 });
            const achievement = new Achievement(
                definition.name,
                definition.description,
                this.requirementFor(definition),
                Number(definition.bonus) || 0,
                category,
                definition.achievable ?? null,
            );
            category.totalWeight += achievement.bonusWeight;
            AchievementHandler.achievementList.push(achievement);
            this.achievements.push(achievement);
            if (this.gameReady) {
                // Registered while playing: no fanfare for what is already done
                achievement.unlocked(achievement.isCompleted());
            }
        });
        if (this.gameReady) {
            AchievementHandler.calculateMaxBonus();
            AchievementHandler.filterAchievementList();
        }
    }

    // ---------------------------------------------------------------------------------
    // Game patches, run on document ready before the game starts
    // ---------------------------------------------------------------------------------

    static installGamePatches() {
        if (AchievementHandler.customAchievementsPatched) {
            console.warn('Custom Achievements: patches already installed, skipping');
            return;
        }
        if (typeof App !== 'undefined' && App.game) {
            throw new Error('The game started before the Custom Achievements script loaded; no achievement can be added this session.');
        }
        const stored = localStorage.getItem(this.SETTING_BONUS);
        this.bonusEnabled = ko.observable(stored === null ? true : stored === 'true');
        this.bonusEnabled.subscribe((value) => {
            localStorage.setItem(this.SETTING_BONUS, value);
            this.applyBonusSetting();
        });

        // A requirement built from a progress function, in the shape of the game's own
        this.Requirement = class CustomRequirement extends AchievementRequirement {
            constructor(definition) {
                super(Number(definition.amount), GameConstants.AchievementOption.more, definition.type ?? GameConstants.AchievementType.None);
                this.definition = definition;
                this.series = definition.series ?? definition.name;
            }

            getProgress() {
                return Math.min(Number(this.definition.progress()) || 0, this.requiredValue);
            }

            hint() {
                return this.definition.hint ?? `${this.requiredValue.toLocaleString('en-US')} needed.`;
            }

            // The achievement tracker chains the tiers whose requirements print alike
            toString() {
                return `CustomRequirement ${this.series} ${this.option}`;
            }
        };

        // The game builds its list in AchievementHandler.initialize, then loads the
        // save (which restores the unlocked ones by name), checks the achievements
        // and computes the bonuses. Only add here: evaluating any achievement before
        // the save is loaded throws in the game's own requirements.
        const initializeOld = AchievementHandler.initialize;
        AchievementHandler.initialize = function (...args) {
            const result = initializeOld.apply(this, args);
            CustomAchievements.addDefinitions(CustomAchievements.queue().splice(0));
            return result;
        };
        AchievementHandler.customAchievementsPatched = true;
    }

    // Runs once the game has loaded: from now on registrations apply immediately
    static initSettings() {
        if (!AchievementHandler.customAchievementsPatched) {
            throw new Error('The Custom Achievements patches were not installed; the script probably loaded after the game started.');
        }
        this.gameReady = true;
        this.addDefinitions(this.queue().splice(0));
        const settingsBody = createScriptSettingsContainer('Custom Achievements');
        const bonusRow = document.createElement('tr');
        bonusRow.innerHTML = '<td class="p-2" colspan="2"><label class="m-0" for="checkbox-customAchievements-bonus">Custom categories grant their achievement bonus</label>'
            + '<input id="checkbox-customAchievements-bonus" type="checkbox" class="mx-2"></td>';
        settingsBody.appendChild(bonusRow);
        const checkbox = bonusRow.querySelector('input');
        checkbox.checked = this.bonusEnabled();
        checkbox.addEventListener('change', (event) => {
            this.bonusEnabled(event.target.checked);
        });

        const summary = document.createElement('tr');
        const categories = [...this.categories.values()].map(({ displayName, bonus, category }) => {
            const count = this.achievements.filter((a) => a.category === category).length;
            return `${displayName} (${count}, ${bonus}% bonus)`;
        });
        summary.innerHTML = `<td class="p-2 text-muted small" colspan="2">${this.achievements.length} custom achievement(s)`
            + `${categories.length ? ` in ${categories.join(', ')}` : ''}. Scripts register theirs through window.CustomAchievementsQueue.</td>`;
        settingsBody.appendChild(summary);
    }
}

/**
 * Creates container for scripts settings in the settings menu, adding scripts tab if it doesn't exist yet
 */
function createScriptSettingsContainer(name) {
    const settingsID = name.replaceAll(/s/g, '').toLowerCase();
    var settingsContainer = document.getElementById('settings-scripts-container');

    // Create scripts settings tab if it doesn't exist yet
    if (!settingsContainer) {
        // Fixes the Scripts nav item getting wrapped to the bottom by increasing the max width of the window
        document.querySelector('#settingsModal div').style.maxWidth = '850px';
        // Create and attach script settings tab link
        const settingTabs = document.querySelector('#settingsModal ul.nav-tabs');
        const li = document.createElement('li');
        li.classList.add('nav-item');
        li.innerHTML = `<a class="nav-link" href="#settings-scripts" data-toggle="tab">Scripts</a>`;
        settingTabs.appendChild(li);
        // Create and attach script settings tab contents
        const tabContent = document.querySelector('#settingsModal .tab-content');
        scriptSettings = document.createElement('div');
        scriptSettings.classList.add('tab-pane');
        scriptSettings.setAttribute('id', 'settings-scripts');
        tabContent.appendChild(scriptSettings);
        settingsContainer = document.createElement('div');
        settingsContainer.setAttribute('id', 'settings-scripts-container');
        scriptSettings.appendChild(settingsContainer);
    }

    // Create settings container
    const settingsTable = document.createElement('table');
    settingsTable.classList.add('table', 'table-striped', 'table-hover', 'm-0');
    const header = document.createElement('thead');
    header.innerHTML = `<tr><th colspan="2">${name}</th></tr>`;
    settingsTable.appendChild(header);
    const settingsBody = document.createElement('tbody');
    settingsBody.setAttribute('id', `settings-scripts-${settingsID}`);
    settingsTable.appendChild(settingsBody);

    // Insert settings container in alphabetical order
    let settingsList = Array.from(settingsContainer.children);
    let insertBefore = settingsList.find(elem => elem.querySelector('tbody').id > `settings-scripts-${settingsID}`);
    if (insertBefore) {
        insertBefore.before(settingsTable);
    } else {
        settingsContainer.appendChild(settingsTable);
    }

    return settingsBody;
}

function loadEpheniaScript(scriptName, initFunction, priorityFunction) {
    function reportScriptError(scriptName, error) {
        console.error(`Error while initializing '${scriptName}' userscript:\n${error}`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `The '${scriptName}' userscript crashed while loading. Check for updates or disable the script, then restart the game.\n\nReport script issues to the script developer, not to the Pokéclicker team.`,
            timeout: GameConstants.DAY,
        });
    }
    const windowObject = !App.isUsingClient ? unsafeWindow : window;
    // Inject handlers if they don't exist yet
    if (windowObject.epheniaScriptInitializers === undefined) {
        windowObject.epheniaScriptInitializers = {};
        const oldInit = Preload.hideSplashScreen;
        var hasInitialized = false;

        // Initializes scripts once enough of the game has loaded
        Preload.hideSplashScreen = function (...args) {
            var result = oldInit.apply(this, args);
            if (App.game && !hasInitialized) {
                // Initialize all attached userscripts
                Object.entries(windowObject.epheniaScriptInitializers).forEach(([scriptName, initFunction]) => {
                    try {
                        initFunction();
                    } catch (e) {
                        reportScriptError(scriptName, e);
                    }
                });
                hasInitialized = true;
            }
            return result;
        }
    }

    // Prevent issues with duplicate script names
    if (windowObject.epheniaScriptInitializers[scriptName] !== undefined) {
        console.warn(`Duplicate '${scriptName}' userscripts found!`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `Duplicate '${scriptName}' userscripts detected. This could cause unpredictable behavior and is not recommended.`,
            timeout: GameConstants.DAY,
        });
        let number = 2;
        while (windowObject.epheniaScriptInitializers[`${scriptName} ${number}`] !== undefined) {
            number++;
        }
        scriptName = `${scriptName} ${number}`;
    }
    // Add initializer for this particular script
    windowObject.epheniaScriptInitializers[scriptName] = initFunction;
    // Run any functions that need to execute before the game starts
    if (priorityFunction) {
        $(document).ready(() => {
            try {
                priorityFunction();
            } catch (e) {
                reportScriptError(scriptName, e);
                // Remove main initialization function
                windowObject.epheniaScriptInitializers[scriptName] = () => null;
            }
        });
    }
}

if (!App.isUsingClient || localStorage.getItem('customachievements') === 'true') {
    // Other scripts reach the API on the page's window
    (!App.isUsingClient ? unsafeWindow : window).CustomAchievements = CustomAchievements;
    loadEpheniaScript('customachievements', () => CustomAchievements.initSettings(), () => CustomAchievements.installGamePatches());
}
