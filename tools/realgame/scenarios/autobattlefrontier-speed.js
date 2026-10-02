// Scenario for tools/realgame/start.mjs, with autobattlefrontier: check the battle speed
// against the real game. The Battle Frontier case of the game's gameTick is replayed by
// hand on a fake clock, and the attacks landed, the stage timer and the stages cleared are
// compared with what the game does on its own, times the speed.
try {
    const out = [];
    let failed = false;
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        failed ||= !condition;
    };

    App.game.party.gainPokemonById(1);

    // The game throttles the attacks on Date.now(): one game tick is 100ms on this clock
    let clock = Date.now();
    Date.now = () => clock;

    // Count the attacks, and decide what they deal
    let attacks = 0;
    let damage = 0;
    App.game.party.calculatePokemonAttack = () => {
        attacks++;
        return damage;
    };

    const run = (speed, ticks, attackDamage) => {
        BattleFrontierRunner.end();
        BattleFrontierRunner.checkpoint(1);
        App.game.statistics.battleFrontierHighestStageCompleted(0);
        AutoBattleFrontier.setBattleFrontSpeed(speed);
        App.game.battleFrontier.enter();
        BattleFrontierRunner.start(true);
        BattleFrontierBattle.counter = 0;
        BattleFrontierBattle.alternateAttack = false;
        BattleFrontierBattle.lastPokemonAttack = 0;
        attacks = 0;
        damage = attackDamage;
        for (let i = 0; i < ticks; i++) {
            clock += GameConstants.TICK_TIME;
            // What Game.gameTick does in the battleFrontier state
            BattleFrontierBattle.counter += GameConstants.TICK_TIME;
            if (BattleFrontierBattle.counter >= GameConstants.BATTLE_FRONTIER_TICK) {
                BattleFrontierBattle.tick();
            }
            BattleFrontierRunner.tick();
        }
        return {
            attacks,
            elapsed: GameConstants.GYM_TIME - BattleFrontierRunner.timeLeft(),
            stage: BattleFrontierRunner.stage(),
            index: BattleFrontierBattle.pokemonIndex(),
            started: BattleFrontierRunner.started(),
        };
    };

    check('the script is loaded', typeof AutoBattleFrontier === 'function' && document.getElementById('bf-speed-select') !== null);

    // Harmless attacks on a stage never beaten: one attack per second of battle
    const base = run(1, 40, 0);
    check('x1 is the game untouched', base.started && base.attacks === 4 && base.elapsed === 4000,
        `${base.attacks} attacks, ${base.elapsed}ms on the timer`);
    for (const speed of [2, 4]) {
        const fast = run(speed, 40, 0);
        check(`x${speed} lands ${speed} times the attacks and runs the timer ${speed} times faster`,
            fast.started && fast.attacks === base.attacks * speed && fast.elapsed === base.elapsed * speed,
            `${fast.attacks} attacks, ${fast.elapsed}ms on the timer`);
    }
    for (const speed of [8, 16]) {
        // Fewer ticks, or the 30s of the stage run out
        const fast = run(speed, 10, 0);
        check(`x${speed} lands ${speed} times the attacks and runs the timer ${speed} times faster`,
            fast.started && fast.attacks === speed && fast.elapsed === 1000 * speed,
            `${fast.attacks} attacks, ${fast.elapsed}ms on the timer`);
    }

    // Attacks that knock out: three Pokémon per stage
    const slowKills = run(1, 40, 1e30);
    check('x1 clears 4 Pokémon in 4s', slowKills.stage === 2 && slowKills.index === 1, `stage ${slowKills.stage}, Pokémon ${slowKills.index}`);
    const fastKills = run(4, 40, 1e30);
    check('x4 clears 16 Pokémon in 4s', fastKills.stage === 6 && fastKills.index === 1, `stage ${fastKills.stage}, Pokémon ${fastKills.index}`);

    // The stage is lost when the sped up timer runs out, and the replayed ticks stop there
    const lost = run(16, 40, 0);
    check('x16 loses the stage once 30s of battle have passed', !lost.started && lost.attacks === 30, `started ${lost.started}, ${lost.attacks} attacks`);

    // The setting
    AutoBattleFrontier.setBattleFrontSpeed('8');
    check('the speed is saved', AutoBattleFrontier.battleFrontSpeed === 8 && localStorage.getItem('battleFrontSpeed') === '8'
        && document.getElementById('bf-speed-select').value === '8');
    AutoBattleFrontier.setBattleFrontSpeed('3');
    check('an unknown speed falls back to x1', AutoBattleFrontier.battleFrontSpeed === 1 && localStorage.getItem('battleFrontSpeed') === '1');

    BattleFrontierRunner.end();
    App.game.battleFrontier.leave();

    console.log(out.join('\n'));
    window.__scenario = !failed;
} catch (error) {
    console.log(`scenario error: ${error.stack || error}`);
    window.__scenario = false;
}
