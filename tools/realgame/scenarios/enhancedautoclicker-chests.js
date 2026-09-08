// Scenario for tools/realgame/start.mjs, with enhancedautoclicker: check the Auto Dungeon
// chest filter against the real game. Chest tiers are rigged to cycle through every loot
// tier, then a dungeon is run to the boss with chests mode on and each selectable minimum
// tier: only chests of that tier or above may be opened. Single- and two-floor dungeons,
// with and without Flash, and the fights mode combined.
try {
    const out = [];
    let failed = false;

    // A fresh save cannot enter Viridian Forest yet: ticket, tokens and Route 2
    App.game.keyItems.gainKeyItem(KeyItemType.Dungeon_ticket, true);
    App.game.wallet.gainDungeonTokens(10000000);
    App.game.statistics.routeKills[GameConstants.Region.kanto][1](GameConstants.ROUTE_KILLS_NEEDED);
    App.game.statistics.routeKills[GameConstants.Region.kanto][2](GameConstants.ROUTE_KILLS_NEEDED);
    App.game.party.gainPokemonById(1);
    // No catch attempts: their timers would keep the runner waiting
    App.game.pokeballs.calculatePokeballToUse = () => GameConstants.Pokeball.None;
    const dungeon = TownList['Viridian Forest'].dungeon;
    player.town = TownList['Viridian Forest'];
    const tiers = Object.keys(baseLootTierChance);

    const opened = [];
    const openChest = DungeonRunner.openChest.bind(DungeonRunner);
    DungeonRunner.openChest = function () {
        opened.push(`${DungeonRunner.map.playerPosition().floor}:${DungeonRunner.map.currentTile().metadata?.tier}`);
        return openChest();
    };

    const run = (size, clears, lootTier, chestMode, encounterMode) => {
        opened.length = 0;
        dungeon.getDungeonSize = () => size;
        App.game.statistics.dungeonsCleared[GameConstants.getDungeonIndex(dungeon.name)](clears);
        App.game.gameState = GameConstants.GameState.town;
        if (DungeonRunner.initializeDungeon(dungeon) === false) {
            out.push(`FAIL could not start the dungeon (size ${size}, ${clears} clears)`);
            failed = true;
            return;
        }
        // Rig the chest tiers so every tier is present
        const placed = [];
        let i = 0;
        DungeonRunner.map.board().forEach((floor, f) => {
            for (const row of floor) {
                for (const tile of row) {
                    if (tile.type() === GameConstants.DungeonTileType.chest) {
                        tile.metadata.tier = tiers[i++ % tiers.length];
                        placed.push(`${f}:${tile.metadata.tier}`);
                    }
                }
            }
        });
        EnhancedAutoClicker.autoDungeonChestMode = chestMode;
        EnhancedAutoClicker.autoDungeonEncounterMode = encounterMode;
        EnhancedAutoClicker.autoDungeonLootTier = lootTier;
        EnhancedAutoClicker.autoDungeonAlwaysOpenRareChests = false;
        EnhancedAutoClicker.autoDungeonState(true);
        EnhancedAutoClicker.autoDungeonTracker.ID = -1; // force a rescan

        // Tick the runner until it starts the boss fight, winning every fight instantly
        let ticks = 0;
        let bossStarted = false;
        const startBossFight = DungeonRunner.startBossFight;
        DungeonRunner.startBossFight = () => { bossStarted = true; };
        while (ticks < 5000 && !bossStarted && EnhancedAutoClicker.autoDungeonState()) {
            if (DungeonRunner.fighting()) {
                if (DungeonBattle.enemyPokemon()) {
                    DungeonBattle.defeatPokemon();
                } else {
                    DungeonRunner.fighting(false);
                    DungeonRunner.map.currentTile().type(GameConstants.DungeonTileType.empty);
                }
            } else {
                EnhancedAutoClicker.autoDungeon();
            }
            ticks++;
        }
        DungeonRunner.startBossFight = startBossFight;

        const expected = chestMode ? placed.filter((t) => tiers.indexOf(t.split(':')[1]) >= lootTier) : [];
        const below = opened.filter((t) => tiers.indexOf(t.split(':')[1]) < lootTier);
        const ok = bossStarted && opened.length === expected.length && below.length === 0;
        failed ||= !ok;
        out.push(`${ok ? 'ok  ' : 'FAIL'} size=${size} floors=${DungeonRunner.map.floorSizes} flash=${EnhancedAutoClicker.autoDungeonTracker.flashTier}`
            + ` tier=${tiers[lootTier]} chests=${chestMode} fights=${encounterMode}`
            + ` -- placed ${placed.length}, expected ${expected.length}, opened [${opened}], boss ${bossStarted}, ${ticks} ticks`);
    };

    run(9, 0, 0, true, false);
    run(9, 0, 1, true, false);
    run(9, 150, 2, true, false);
    run(9, 500, 1, true, true);
    run(9, 0, 1, false, false);
    run(14, 0, 1, true, false);
    run(14, 150, 2, true, false);
    run(14, 500, 1, true, true);
    run(14, 500, 4, true, false);

    console.log(out.join('\n'));
    window.__scenario = !failed;
} catch (error) {
    console.log(`scenario error: ${error.stack || error}`);
    window.__scenario = false;
}
