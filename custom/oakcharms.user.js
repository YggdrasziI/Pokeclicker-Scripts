// ==UserScript==
// @name          [Pokeclicker] Oak Charms
// @namespace     Pokeclicker Scripts
// @author        YggdrasziI
// @description   Adds five Oak Items to the game's own Oak Items window: the Quest Charm, Farm Charm and Battle Charm multiply the Quest Points, Farm Points and Battle Points you gain, the way the Amulet Coin multiplies money, the Dowsing Charm makes Pokémon drop held items and dungeon chests multiply their loot more often, like the Dowsing Machine, and the Roaming Charm makes roaming Pokémon appear more often, up to the x3 of a boosted route, and shows its bonus next to the roaming odds of the route's encounters window. Each unlocks on its own condition and levels up by using it.
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       1.8.0

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakcharms.user.js
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/custom/oakcharms.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

// One entry per added Oak Item. The order is the order of their enum values and
// of their tiles, and 'key' is the name they are saved under: never reorder or
// rename an entry once released. Each charm has ten levels: the first five on the
// scale of the game's own Oak Items, the last five far steeper, on the scale of
// the Oak Items Overload script (each costs the level 5 upgrade times 10, 50, 250,
// 1,000 then 5,000, and needs its experience times 3, 10, 30, 100 then 300).
//   currency:  the wallet currency the charm multiplies, null for a charm applied
//              and fed by its own hooks instead
//   expOnGain: exp granted when that currency is gained (base amount, bonus applied)
//   expGain:   exp granted by one plain use of the charm, 1 when omitted; the window
//              shows the progress in uses, like the game does for its own items
//   icon:      replaces the missing assets/images/oakitems/<key>.png; a raster icon
//              is redrawn at the size of the game's sprites, an SVG used as is
const oakCharms = [
    {
        key: 'Quest_Charm',
        displayName: 'Quest Charm',
        description: 'Gain more Quest Points from quests',
        bonusList: [1.15, 1.25, 1.5, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50],
        expList: [10, 100, 250, 500, 1000, 3000, 10000, 30000, 100000, 300000],
        costList: [1000000, 2500000, 5000000, 10000000, 20000000, 200000000, 1000000000, 5000000000, 20000000000, 100000000000],
        currency: 'questPoint',
        // One exp per quest reward, whatever its size
        expOnGain: () => 1,
        isUnlocked: () => player.highestRegion() >= GameConstants.Region.johto,
        hint: 'Reach the Johto region',
        icon: 'assets/images/currency/questPoint.svg',
    },
    {
        key: 'Farm_Charm',
        displayName: 'Farm Charm',
        description: 'Gain more Farm Points from harvesting',
        bonusList: [1.25, 1.30, 1.35, 1.40, 1.45, 1.50, 1.70, 1.90, 2.10, 2.30, 2.50],
        expList: [1000, 10000, 25000, 100000, 250000, 750000, 2500000, 7500000, 25000000, 75000000],
        costList: [75000, 150000, 375000, 750000, 1500000, 15000000, 75000000, 375000000, 1500000000, 7500000000],
        currency: 'farmPoint',
        // One exp per Farm Point actually received
        expOnGain: (base, bonus) => Math.floor(base * bonus),
        isUnlocked: () => App.game.farming.unlockedBerries.filter((unlocked) => unlocked()).length >= 5,
        hint: 'Unlock 5 berries',
        icon: 'assets/images/currency/farmPoint.svg',
    },
    {
        key: 'Battle_Charm',
        displayName: 'Battle Charm',
        description: 'Gain more Battle Points from the Battle Frontier',
        bonusList: [1.25, 1.35, 1.50, 1.60, 1.75, 2.00, 2.30, 2.60, 2.90, 3.20, 3.50],
        expList: [500, 1000, 2500, 5000, 7500, 10000, 12500, 17500, 20000, 25000],
        costList: [10000000, 25000000, 50000000, 100000000, 500000000, 5000000000, 25000000000, 125000000000, 500000000000, 2500000000000],
        currency: 'battlePoint',
        // Exp comes from stages completed instead, see the BattleFrontierRunner hook
        expOnGain: () => 0,
        isUnlocked: () => App.game.party.alreadyCaughtPokemonByName('Deoxys'),
        hint: 'Obtain Deoxys at stage 100 of the Battle Frontier',
        icon: 'assets/images/currency/battlePoint.svg',
    },
    {
        key: 'Dowsing_Charm',
        displayName: 'Dowsing Charm',
        description: 'Pokémon drop held items and dungeon chests multiply their loot more often',
        // Level 10 is the Dowsing Machine's own x1.5
        bonusList: [1.10, 1.14, 1.18, 1.22, 1.26, 1.30, 1.34, 1.38, 1.42, 1.46, 1.50],
        expList: [25, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
        costList: [100000, 250000, 500000, 1000000, 2500000, 25000000, 125000000, 625000000, 2500000000, 12500000000],
        // Not a currency charm: exp comes from the held item and dungeon chest hooks
        currency: null,
        isUnlocked: () => player.highestRegion() >= GameConstants.Region.hoenn,
        hint: 'Reach the Hoenn region',
        icon: 'assets/images/items/battleItem/Dowsing_machine.png',
    },
    {
        key: 'Roaming_Charm',
        displayName: 'Roaming Charm',
        description: 'Encounter roaming Pokémon more often',
        // The Shiny Charm's own levels, as extended by Oak Items Overload: level 10 is
        // the x3 of a boosted route (GameConstants.ROAMING_INCREASED_CHANCE)
        bonusList: [1.50, 1.60, 1.70, 1.80, 1.90, 2.00, 2.20, 2.40, 2.60, 2.80, 3.00],
        expList: [500, 1000, 2500, 5000, 10000, 30000, 100000, 300000, 1000000, 2000000],
        costList: [50000, 100000, 250000, 500000, 1000000, 10000000, 50000000, 250000000, 1000000000, 5000000000],
        // Not a currency charm: exp comes from the roaming encounter hook, 150 per
        // roamer met, like the Shiny Charm's 150 per shiny
        currency: null,
        expGain: 150,
        isUnlocked: () => App.game.party.caughtPokemon.length >= 70,
        hint: 'Capture 70 unique Pokémon',
        icon: 'assets/images/encountersInfo/roaming.png',
    },
];

// Exp a dungeon chest grants the Dowsing Charm, by the game's loot tier weight
// (common 4, rare 3, epic 2, legendary 1, mythic 0): common chests give nothing
const dowsingChestExp = { 3: 1, 2: 2, 1: 3, 0: 5 };

function oakCharmItem(charm) {
    return App.game.oakItems.itemList[OakItemType[charm.key]];
}

// Which charms the player uses, one switch each in the Scripts tab of the settings,
// stored once for every save as { key: false } for the charms turned off. A charm
// turned off stays registered, so its enum value, its loadout entries and its side
// store entry survive the switch, but it is locked, hidden from the Oak Items window
// and never equipped. Applied at once.
const charmsEnabledKey = 'oakCharmsEnabled';
let charmsEnabled = loadCharmsEnabled();
const charmTiles = {};

function loadCharmsEnabled() {
    try {
        const stored = JSON.parse(localStorage.getItem(charmsEnabledKey));
        return stored !== null && typeof stored === 'object' ? stored : {};
    } catch {
        return {};
    }
}

function charmEnabled(charm) {
    return charmsEnabled[charm.key] !== false;
}

function setCharmEnabled(charm, enabled) {
    charmsEnabled[charm.key] = enabled;
    localStorage.setItem(charmsEnabledKey, JSON.stringify(charmsEnabled));
    (charmTiles[charm.key] ?? []).forEach((tile) => {
        tile.hidden = !enabled;
    });
    if (!enabled && App.game?.oakItems) {
        App.game.oakItems.deactivate(OakItemType[charm.key]);
    }
}

// Achievements for the charms, picked up by the Custom Achievements script when it is
// installed, in a category of their own: the game's "max level Oak Item" achievements
// and their bonus never see the charms. Two series shaped like the game's tiers, one at
// level 5 (the scale of the game's own Oak Items) and one at level 10, then one on the
// roaming Pokémon met with the Roaming Charm equipped.
function oakCharmAchievementDefinitions() {
    const category = { name: 'oakCharms', displayName: 'Oak Charms', bonus: 10 };
    const achievable = () => !App.game.challenges.list.disableOakItems.active();
    const total = oakCharms.length;
    const series = {
        5: [[1, 0.05, 'Charmed, I\'m Sure'], [2, 0.10, 'Twice as Charming'], [3, 0.14, 'Third Time\'s the Charm'], [total, 0.18, 'Full Charm Bracelet']],
        10: [[1, 0.10, 'Charm Overload'], [2, 0.14, 'Double Charm Overload'], [3, 0.16, 'Triple Charm Overload'], [total, 0.18, 'Charm Offensive']],
    };
    const levels = Object.entries(series).flatMap(([level, tiers]) => tiers.map(([amount, bonus, name]) => ({
        name,
        description: `Level ${amount === total ? `all ${total}` : amount} Oak Charm${amount > 1 ? 's' : ''} to level ${level}.`,
        progress: () => oakCharms.filter((charm) => oakCharmItem(charm).level >= Number(level)).length,
        amount,
        bonus,
        category,
        type: GameConstants.AchievementType['Max Level Oak Item'],
        series: `oakCharms:${level}`,
        hint: `${amount} Oak Charm${amount > 1 ? 's' : ''} leveled to level ${level}.`,
        achievable,
    })));
    const roamingCharm = oakCharms.find((c) => c.key === 'Roaming_Charm');
    const roamers = [[100, 0.05, 'Roam Sweet Roam'], [1000, 0.10, 'Born to Roam'], [10000, 0.14, 'Legends Never Rest']].map(([amount, bonus, name]) => ({
        name,
        description: `Encounter ${amount.toLocaleString('en-US')} roaming Pokémon with the Roaming Charm equipped.`,
        progress: () => oakCharmItem(roamingCharm).uses,
        amount,
        bonus,
        category,
        series: 'oakCharms:roamers',
        hint: `${amount.toLocaleString('en-US')} roaming Pokémon encountered with the Roaming Charm equipped.`,
        achievable,
    }));
    return levels.concat(roamers);
}

// The charm progress (level, exp, equipped) lives outside the game save, so a save
// file or a backup never carries anything the unmodified game would not write.
// It is kept per save file in the browser storage, like the game's own save, and
// the desktop client mirrors it to a small file next to its save backups.
let charmsLoaded = false;
let lastCharmsHandedOver = null;

function charmProgressKey() {
    return `oakCharms-${Save.key}`;
}

function isCharmProgress(value) {
    return value !== null && typeof value === 'object'
        && oakCharms.some((charm) => value[charm.key] !== undefined);
}

function loadCharmProgress() {
    try {
        const stored = JSON.parse(localStorage.getItem(charmProgressKey()));
        return isCharmProgress(stored) ? stored : null;
    } catch {
        return null;
    }
}

function storeCharmProgress(charms) {
    localStorage.setItem(charmProgressKey(), JSON.stringify(charms));
}

function currentProfileName() {
    try {
        return JSON.parse(localStorage.getItem(`save${Save.key}`))?.profile?.name ?? null;
    } catch {
        return null;
    }
}

// The desktop client hands over the files found in its save-backups folder as
// DesktopSaveBackupFiles. Only used when this browser profile holds nothing for the
// save, which is what happens after importing a backup into a fresh install: the
// file for the same save key wins, then one for the same trainer name.
function restoreCharmProgressFromClient() {
    const files = Object.values(window.DesktopSaveBackupFiles ?? {}).flatMap((contents) => {
        try {
            const parsed = JSON.parse(contents);
            return (parsed?.format === 1 && isCharmProgress(parsed.charms)) ? [parsed] : [];
        } catch {
            return [];
        }
    });
    const profile = currentProfileName();
    const match = files.find((file) => file.saveKey === Save.key)
        ?? files.find((file) => profile !== null && file.profile === profile);
    return match?.charms ?? null;
}

// Polled by the desktop client's main process, which owns the filesystem. Returns
// null while nothing changed, so the poll costs nothing between charm level-ups.
function collectOakCharmsBackup() {
    if (!charmsLoaded || !App.game?.oakItems) {
        return null;
    }
    const charms = {};
    oakCharms.forEach((charm) => {
        charms[charm.key] = oakCharmItem(charm).toJSON();
    });
    const serialized = JSON.stringify(charms);
    if (serialized === lastCharmsHandedOver) {
        return null;
    }
    lastCharmsHandedOver = serialized;

    const profile = App.game.profile.name() || 'Trainer';
    // Keep it filesystem-safe: the trainer name is free text
    const safe = (text) => String(text).replace(/[^\w \-.]/g, '_');
    return {
        filename: `${safe(profile)} [${safe(Save.key || 'default')}] oak-charms.json`,
        contents: JSON.stringify({ format: 1, saveKey: Save.key, profile, charms }, null, 2),
    };
}

// Runs on document ready, before the game builds its Oak Item list and applies
// its Knockout bindings. Everything that changes what the game *constructs*
// has to happen here.
function initOakCharmsOverrides() {
    if (OakItemType[oakCharms[0].key] !== undefined) {
        console.warn('Oak Charms: Oak Items already registered, skipping overrides');
        return;
    }
    if (typeof App !== 'undefined' && App.game) {
        throw new Error('The game started before the Oak Charms script loaded; the Oak Items cannot be added this session.');
    }

    // Achievements, picked up by the Custom Achievements script whichever loads first
    const windowObject = !App.isUsingClient ? unsafeWindow : window;
    windowObject.CustomAchievementsQueue = windowObject.CustomAchievementsQueue ?? [];
    windowObject.CustomAchievementsQueue.push(() => oakCharmAchievementDefinitions());

    // Extend the OakItemType enum in both directions, like a TypeScript enum.
    // OakItems.toJSON keys the save by OakItemType[item.name], and fromJSON only
    // reads the enum's names, so both mappings are needed for the items to persist.
    let nextIndex = Object.keys(OakItemType).filter((key) => Number.isNaN(Number(key))).length;
    oakCharms.forEach((charm) => {
        OakItemType[nextIndex] = charm.key;
        OakItemType[charm.key] = nextIndex;
        nextIndex++;
    });

    class OakCharm extends OakItem {
        constructor(charm) {
            super(OakItemType[charm.key], charm.displayName, charm.description, true, charm.bonusList, 1, 0, charm.expGain ?? 1,
                charm.expList, charm.costList.length, AmountFactory.createArray(charm.costList, GameConstants.Currency.money));
            this.charm = charm;
            // Not one of the game's Oak Items: never counted by the game's "max level
            // Oak Item" achievements, see maxLevelOakItems below
            this.customOakItem = true;
            // Uses while equipped, kept with the level and exp for the charm achievements:
            // the game's own count sits in the save, under the charm's enum index. An
            // observable, like level, so the achievements' computed completion follows it.
            this.usesKO = ko.observable(0);
        }

        get uses() {
            return this.usesKO();
        }

        set uses(value) {
            this.usesKO(value);
        }

        // The base class only uses an equipped item, and stops granting exp at the last
        // level; the count goes on.
        use(...args) {
            if (this.isActive) {
                this.uses += 1;
            }
            super.use(...args);
        }

        toJSON() {
            return { ...super.toJSON(), uses: this.uses };
        }

        fromJSON(json) {
            super.fromJSON(json);
            this.uses = Number(json?.uses) || 0;
        }

        // The base class unlocks on unique pokémon caught; each charm has its own
        // condition, and a charm turned off in the settings stays locked.
        isUnlocked() {
            return charmEnabled(this.charm) && this.charm.isUnlocked();
        }

        getHint() {
            return charmEnabled(this.charm) ? this.charm.hint : 'Turned off in the Scripts settings';
        }

        get hint() {
            return ko.pureComputed(() => this.getHint());
        }
    }

    // Add the items right after the game builds its own list, before Game.load()
    // reads the save and before Knockout renders the (non-observable) list.
    const initializeOld = OakItems.prototype.initialize;
    OakItems.prototype.initialize = function (...args) {
        const result = initializeOld.apply(this, args);
        oakCharms.forEach((charm) => {
            if (this.itemList[OakItemType[charm.key]] === undefined) {
                this.itemList[OakItemType[charm.key]] = new OakCharm(charm);
            }
        });
        // The held item drop roll divides its odds by this multiplier, the way the
        // Dowsing Machine registers its own x1.5. The game reads it without the
        // "use" flag, so the roll grants no exp: the loot hooks below do.
        this.multiplier.addBonus('rareItemDropRate', () => this.calculateBonus(OakItemType.Dowsing_Charm), 'Dowsing Charm');
        // PokemonFactory.roamingRate divides its 1-in-N odds by this multiplier, next
        // to the boosted route's x3 and the farm auras, and reads it without the "use"
        // flag as well: the roaming encounter hook below grants the exp.
        this.multiplier.addBonus('roaming', () => this.calculateBonus(OakItemType.Roaming_Charm), 'Roaming Charm');

        // The game's "max level Oak Items" achievements count from maxLevelOakItems, which
        // the game recomputes from every item of the list, charms included. Count only
        // the game's own items, at the game's own maximum (Oak Items Overload raises
        // maxLevel and records the game's in overloadBaseMaxLevel; it installs this same
        // rule, so the load order does not matter), and ignore the game's writes.
        this.maxLevelOakItems = ko.pureComputed({
            read: () => this.itemList.filter((item) => !item.customOakItem && item.level >= (item.overloadBaseMaxLevel ?? item.maxLevel)).length,
            write: () => {},
        });
        return result;
    };

    // The game serializes every item of the list, charms included. Take them back out
    // so the save stays vanilla, and refresh the side store instead: toJSON runs at
    // every save tick, on download and for backups, which is exactly the cadence wanted.
    const toJSONOld = OakItems.prototype.toJSON;
    OakItems.prototype.toJSON = function (...args) {
        const save = toJSONOld.apply(this, args);
        const charms = {};
        oakCharms.forEach((charm) => {
            charms[charm.key] = save[charm.key];
            delete save[charm.key];
        });
        // Game.load() may call toJSON before fromJSON on a brand-new save; never let
        // the defaults overwrite a store that has not been read yet
        if (charmsLoaded) {
            storeCharmProgress(charms);
        }
        return save;
    };

    // The original still applies charm keys found in a save written by an older
    // version of this script, so an upgrade loses nothing; the side store then wins.
    const fromJSONOld = OakItems.prototype.fromJSON;
    OakItems.prototype.fromJSON = function (json, ...args) {
        const result = fromJSONOld.call(this, json, ...args);
        const stored = loadCharmProgress() ?? restoreCharmProgressFromClient();
        if (stored) {
            oakCharms.forEach((charm) => {
                const item = this.itemList[OakItemType[charm.key]];
                if (item && stored[charm.key]) {
                    item.fromJSON(stored[charm.key]);
                }
            });
        }
        // A charm turned off in the settings is never equipped, whatever the store says
        oakCharms.filter((charm) => !charmEnabled(charm)).forEach((charm) => {
            this.itemList[OakItemType[charm.key]].isActive = false;
        });
        charmsLoaded = true;
        return result;
    };

    // Every currency gain goes through Wallet.addAmount -> calcBonus, which
    // returns 1 for these currencies in the base game. OakItem.use() only grants
    // exp while the item is equipped, so an unequipped charm stays at x1 and
    // gains nothing. addAmount skips calcBonus entirely when ignoreBonus is set,
    // so flat rewards stay flat.
    const calcBonusOld = Wallet.prototype.calcBonus;
    Wallet.prototype.calcBonus = function (amount, ...args) {
        const charm = oakCharms.find((c) => c.currency && amount?.currency === GameConstants.Currency[c.currency]);
        if (charm && App.game?.oakItems) {
            const item = oakCharmItem(charm);
            const bonus = item.calculateBonus();
            const exp = charm.expOnGain(amount.amount, bonus);
            if (exp > 0) {
                item.use(exp);
            }
            return bonus;
        }
        return calcBonusOld.call(this, amount, ...args);
    };

    // The Battle Charm levels on Battle Frontier stages completed, one exp each.
    const nextStageOld = BattleFrontierRunner.nextStage;
    BattleFrontierRunner.nextStage = function (...args) {
        const result = nextStageOld.apply(this, args);
        if (App.game?.oakItems) {
            oakCharmItem(oakCharms.find((c) => c.key === 'Battle_Charm')).use();
        }
        return result;
    };

    const dowsingCharm = oakCharms.find((c) => c.key === 'Dowsing_Charm');

    // The Dowsing Charm levels on held items dropped by defeated Pokémon, one exp each
    const defeatOld = BattlePokemon.prototype.defeat;
    BattlePokemon.prototype.defeat = function (...args) {
        const result = defeatOld.apply(this, args);
        if (this.heldItem && App.game?.oakItems) {
            oakCharmItem(dowsingCharm).use();
        }
        return result;
    };

    // ...and on dungeon chests of the rare tier and above, more for the rarer tiers.
    // gainLoot receives the chest's tier weight; it is only called from openChest.
    const gainLootOld = DungeonRunner.gainLoot;
    DungeonRunner.gainLoot = function (input, amount, weight, ...args) {
        const result = gainLootOld.call(this, input, amount, weight, ...args);
        const exp = dowsingChestExp[weight];
        if (exp && App.game?.oakItems) {
            oakCharmItem(dowsingCharm).use(undefined, exp);
        }
        return result;
    };

    // The Roaming Charm levels on roaming Pokémon met, the way the Shiny Charm levels
    // on shinies: generateRoamingEncounter, called by generateWildPokemon for every
    // wild encounter, returns the roamer's name once its roll succeeds, false otherwise.
    const roamingCharm = oakCharms.find((c) => c.key === 'Roaming_Charm');
    const generateRoamingEncounterOld = PokemonFactory.generateRoamingEncounter;
    PokemonFactory.generateRoamingEncounter = function (...args) {
        const result = generateRoamingEncounterOld.apply(this, args);
        if (result && App.game?.oakItems) {
            oakCharmItem(roamingCharm).use();
        }
        return result;
    };

    // The route's encounters window shows the roaming odds from roamingRate, charm
    // included, and marks a boosted route with an arrow and a tooltip line: mark the
    // charm's share the same way, in its own colour. The window's content sits under
    // a knockout "if" and is rebuilt every time it opens, so the template itself is
    // edited here, before the game binds it.
    const boostedMark = document.querySelector('#routeInfoModal span[data-bind="visible: isBoosted"]');
    if (boostedMark) {
        const bonus = 'App.game.oakItems.calculateBonus(OakItemType.Roaming_Charm)';
        const percent = `Math.round((${bonus} - 1) * 100)`;
        const charmMark = document.createElement('span');
        charmMark.className = 'small ml-1 oakcharms-roaming-bonus';
        charmMark.setAttribute('data-bind', `visible: ${bonus} > 1, text: '+' + ${percent} + '%'`);
        boostedMark.after(charmMark);
        // The tooltip title is a template literal: append the charm's line to it
        const tooltip = boostedMark.parentElement;
        const binding = tooltip.getAttribute('data-bind') ?? '';
        const titleEnd = ' : \'\')}`';
        const charmLine = `\${${bonus} > 1 ? '<br/><br/>Roaming Charm: +' + ${percent} + '% (×' + ${bonus} + '), already counted in this chance.' : ''}`;
        if (binding.split(titleEnd).length === 2) {
            tooltip.setAttribute('data-bind', binding.replace(titleEnd, `${titleEnd.slice(0, -1)}${charmLine}\``));
        } else {
            console.warn('Oak Charms: roaming tooltip not found, the Roaming Charm has no line in it');
        }
    } else {
        console.warn('Oak Charms: route encounters window not found, the Roaming Charm bonus is not shown there');
    }

    // The chest's "more loot" roll is hard-coded in openChest: the game multiplies
    // its chance by 1.5 while a Dowsing Machine runs, then rolls it with the first
    // Rand.chance call of the function, before gainLoot. Scale that one roll by
    // the charm bonus and leave the later rolls (a loot Pokémon's shiny and held
    // item odds) alone. Rand.chance is a static inherited from SeededRand that
    // relies on `this`, hence the plain functions and the own-property cleanup.
    const openChestOld = DungeonRunner.openChest;
    DungeonRunner.openChest = function (...args) {
        const bonus = App.game?.oakItems ? oakCharmItem(dowsingCharm).calculateBonus() : 1;
        if (!(bonus > 1)) {
            return openChestOld.apply(this, args);
        }
        const chanceOld = Rand.chance;
        const ownChance = Object.getOwnPropertyDescriptor(Rand, 'chance');
        let firstRoll = true;
        Rand.chance = function (chance, ...rest) {
            if (firstRoll) {
                firstRoll = false;
                chance *= bonus;
            }
            return chanceOld.call(this, chance, ...rest);
        };
        try {
            return openChestOld.apply(this, args);
        } finally {
            if (ownChance) {
                Object.defineProperty(Rand, 'chance', ownChance);
            } else {
                delete Rand.chance;
            }
        }
    };

    // The Oak Item grids break their rows every 4 items, and a Bootstrap .col alone
    // on its row takes the full width, so a lone tile came out four times too big.
    // Pinning every tile to a quarter row changes nothing for the full rows. The
    // rows are also centered, which left a lone tile in the middle of its row:
    // start every row at the left, under the first column, like a grid.
    const style = document.createElement('style');
    style.textContent = '#oakItemsModal ul.row > li.col { flex: 0 0 25%; max-width: 25%; }'
        + ' #oakItemsModal ul.row.justify-content-center { justify-content: flex-start !important; }'
        + ' .oakcharms-roaming-bonus { color: #ffd54f; font-weight: bold; }';
    document.head.appendChild(style);

    // The tiles size themselves on the sprite: the game's Oak Item sprites are 120
    // pixels wide with the item drawn on 96, and the borrowed roaming icon is 25. A
    // raster icon is drawn onto a canvas of the sprites' own size first, on the same
    // 96 pixels, so its tile keeps the geometry of the game's tiles; a small icon is
    // scaled by a whole factor to stay crisp. SVG icons scale by themselves.
    const spriteSize = 120;
    const spriteIcons = {};
    function spriteSizedIcon(charm) {
        return new Promise((resolve) => {
            const icon = new Image();
            icon.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = spriteSize;
                    canvas.height = spriteSize;
                    const context = canvas.getContext('2d');
                    const largest = Math.max(icon.naturalWidth, icon.naturalHeight);
                    const scale = largest < 48 ? Math.floor(100 / largest) : 96 / largest;
                    const width = icon.naturalWidth * scale;
                    const height = icon.naturalHeight * scale;
                    context.imageSmoothingEnabled = !Number.isInteger(scale);
                    context.drawImage(icon, (spriteSize - width) / 2, (spriteSize - height) / 2, width, height);
                    resolve(canvas.toDataURL());
                } catch (error) {
                    console.warn(`Oak Charms: could not draw the ${charm.displayName} icon at the sprite size`, error);
                    resolve(charm.icon);
                }
            };
            icon.onerror = () => resolve(charm.icon);
            icon.src = charm.icon;
        });
    }

    // The Oak Item templates build the image path from the enum key. Image error
    // events do not bubble, so catch them in the capture phase and swap the icon.
    document.addEventListener('error', (event) => {
        const target = event.target;
        if (target?.tagName !== 'IMG') {
            return;
        }
        const charm = oakCharms.find((c) => target.src.endsWith(`oakitems/${c.key}.png`));
        if (!charm) {
            return;
        }
        // The tile of the Oak Items window (and of its Loadouts tab) is the image's
        // list item: kept to hide the charms turned off in the settings
        const tile = target.closest('li');
        if (tile) {
            charmTiles[charm.key] = charmTiles[charm.key] ?? [];
            charmTiles[charm.key].push(tile);
            tile.hidden = !charmEnabled(charm);
        }
        if (/\.svg$/i.test(charm.icon)) {
            target.src = charm.icon;
            return;
        }
        spriteIcons[charm.key] = spriteIcons[charm.key] ?? spriteSizedIcon(charm);
        spriteIcons[charm.key].then((src) => {
            target.src = src;
        });
    }, true);
}

function initOakCharms() {
    if (oakCharms.some((charm) => oakCharmItem(charm) === undefined)) {
        throw new Error('The Oak Charms were not added to the game; the script probably loaded after the game started.');
    }

    // Only the desktop client can write files; it polls this list from its main process
    if (App.isUsingClient) {
        window.DesktopSaveBackupProviders = window.DesktopSaveBackupProviders ?? [];
        window.DesktopSaveBackupProviders.push(collectOakCharmsBackup);
    }

    // One switch per charm in the Scripts tab of the settings
    const settingsBody = createScriptSettingsContainer('Oak Charms');
    oakCharms.forEach((charm) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="p-2" colspan="2"><label class="m-0" for="checkbox-oakCharms-${charm.key}">${charm.displayName}: ${charm.description}</label>`
            + `<input id="checkbox-oakCharms-${charm.key}" type="checkbox" class="mx-2"></td>`;
        settingsBody.appendChild(row);
        const checkbox = row.querySelector('input');
        checkbox.checked = charmEnabled(charm);
        checkbox.addEventListener('change', (event) => {
            setCharmEnabled(charm, event.target.checked);
        });
    });
    const note = document.createElement('tr');
    note.innerHTML = '<td class="p-2 text-muted small" colspan="2">A charm turned off is locked, hidden from the Oak Items window and unequipped at once; its level and experience are kept for when it is turned on again.</td>';
    settingsBody.appendChild(note);
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

if (!App.isUsingClient || localStorage.getItem('oakcharms') === 'true') {
    loadEpheniaScript('oakcharms', initOakCharms, initOakCharmsOverrides);
}
