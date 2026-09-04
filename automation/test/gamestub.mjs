// A deliberately permissive stub of the Pokeclicker globals the automation modules
// touch while building their menus. It is not a simulation: anything unknown resolves
// to a callable that returns another permissive stub, so menu construction can run to
// completion and we can see which module genuinely fails.

const store = new Map();

// A proxy that answers to property access, calls, and the usual coercions.
function permissive(label = 'stub') {
    const fn = function () { return permissive(label); };
    fn.__stub = label;
    return new Proxy(fn, {
        get(target, key) {
            if (key === Symbol.toPrimitive) return () => 0;
            if (key === Symbol.iterator) return [][Symbol.iterator].bind([]);
            if (key === 'then') return undefined;             // not a thenable
            if (key === 'length') return 0;
            if (key === 'name') return label;
            if (key === '__stub') return label;
            if (key === 'constructor') return Object;
            // Array-ish helpers some modules call on collections
            if (['map', 'filter', 'forEach', 'find', 'some', 'every', 'sort', 'flatMap',
                 'reduce', 'concat', 'includes', 'indexOf', 'join', 'slice', 'push'].includes(key)) {
                return () => permissive(label + '.' + String(key));
            }
            if (typeof key === 'symbol') return undefined;
            return permissive(label + '.' + String(key));
        },
        set() { return true; },
        has() { return true; },
        apply() { return permissive(label + '()'); },
        construct() { return permissive('new ' + label); },
    });
}

export function makeGameStub(window) {
    const ctx = {
        console,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        MutationObserver: window.MutationObserver,
        ResizeObserver: class { observe() {} disconnect() {} },
        Image: window.Image,
        setInterval: () => 0,
        clearInterval: () => {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        Math, JSON, Object, Array, Number, String, Boolean, Date, Set, Map, RegExp, Promise, Error,

        localStorage: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
        },
        Save: { key: 'testsave' },
        Notifier: { notify() {} },
        Preload: { hideSplashScreen: () => {} },
        // ko observables are read as functions in a few menu paths
        ko: { observable: (v) => { const o = () => v; o.subscribe = () => {}; return o; },
              pureComputed: (f) => { const o = () => f(); o.subscribe = () => {}; return o; } },
    };

    // App.game.<feature>.canAccess() must answer false-y or true-y without exploding.
    ctx.App = {
        isUsingClient: true,
        game: permissive('App.game'),
    };

    for (const name of ['GameConstants', 'OakItemType', 'PokemonType', 'BerryType', 'ItemList',
                        'UndergroundToolType', 'UndergroundItemValueType', 'UndergroundItems',
                        'GameState', 'Region', 'PokeballType', 'CaughtStatus', 'Pokerus',
                        'MineType', 'MineConfigs', 'Settings', 'player', 'pokemonList',
                        'PartyController', 'BadgeEnums', 'GymList', 'TownList', 'RouteHelper',
                        'DungeonList', 'PokemonHelper', 'GenericDeal', 'BagHandler', 'FarmController',
                        'SeededRand', 'Rand', 'GameHelper', 'NotificationConstants', 'EggType',
                        'QuestLineHelper', 'AchievementHandler', 'SubRegions', 'Challenges',
                        'BattleFrontierRunner', 'DungeonRunner', 'GymRunner', 'Battle', 'Underground',
                        'UndergroundController', 'Mine', 'SafariPokemon', 'Safari', 'SafariBattle',
                        'BattleCafeSaveObject', 'CaughtIndicatingItem', 'MegaStoneType', 'PokeblockType',
                        'FluteItemType', 'EnergyRestoreSize', 'ShardTraderShop', 'BulletinBoards',
                        'WeatherType', 'StoneType', 'EvolutionStone', 'BattleItemType', 'Currency',
                        'Sweets', 'AmuletCoin', 'GymBadgeRequirement',
                        // Verified present in v0.10.26: Routes/SortOptions/Gems/pokemonMap are
                        // window-injected, pokeMartShop is a plain global from scripts/towns/TownList
                        'Routes', 'SortOptions', 'pokeMartShop', 'Gems', 'pokemonMap',
                        'ShopHandler', 'Shop', 'PokemonCategories', 'BreedingController',
                        'dungeonList', 'SortOptionConfigs', 'BattleCafeController', 'GymRunner',
                        'KeyItemType', 'AchievementType', 'MulchType', 'PokemonContestTypes',
                        // Plain globals from src/scripts (not window-injected, but present at runtime)
                        'QuestHelper', 'QuestLineHelper', 'RoamingPokemonList', 'TemporaryBattleList',
                        'BerryDeal', 'FarmHand', 'Plot', 'DungeonGuides', 'HatcheryHelpers']) {
        if (!(name in ctx)) ctx[name] = permissive(name);
    }

    // Content collections must be real (if empty) containers: the modules enumerate
    // them to build their menus, and a proxy would not iterate. Empty means the menu
    // is built with no entries, which still exercises the code path.
    Object.assign(ctx, {
        TownList: {},
        dungeonList: {},
        GymList: {},
        pokemonList: [],
        BattleCafeController: { evolutions: {} },
        pokeMartShop: { items: [] },
        // Real shape: QuestHelper.quests maps names to quest classes exposing generateData()
        QuestHelper: { quests: {}, createQuest: () => ({}) },
        ShopHandler: { shopObservable: () => ({ items: [] }) },
        // Shape matters here: modules call .canUse() and .createSetting() on each option
        pokeballFilterOptions: new Proxy({}, {
            get: () => ({ canUse: () => true, createSetting: () => ({ value: 0 }) }),
        }),
    });

    // A handful need real values rather than stubs
    ctx.GameConstants = new Proxy({
        formatDate: () => '', formatTime: () => '', formatTimeShortWords: () => '',
        Region: permissive('Region'), MAX_AVAILABLE_REGION: 0,
        TotalPokemonsPerRegion: [151], RegionRoute: {}, AchievementType: permissive('AchievementType'),
        DAY: 86400000, HOUR: 3600000, MINUTE: 60000, SECOND: 1000, TICK_TIME: 100,
    }, { get: (t, k) => (k in t ? t[k] : (typeof k === 'symbol' ? undefined : 0)) });

    ctx.NotificationConstants = { NotificationOption: permissive('NotificationOption'),
                                  NotificationSound: permissive('NotificationSound') };

    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.unsafeWindow = ctx;
    return ctx;
}
