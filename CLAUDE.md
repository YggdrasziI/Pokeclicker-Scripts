# Project instructions

## Project

Userscripts for [PokéClicker](https://www.pokeclicker.com/), plus the Electron
desktop client that ships them. Three families of code that do not mix:

- **Standalone Ephenia userscripts** — `*.user.js` at the root and in `custom/`.
  Each is self-contained: a metadata header, a class or a few functions, and a
  registration call at the bottom. They share an ABI (`loadEpheniaScript`,
  `window.epheniaScriptInitializers`, `createScriptSettingsContainer`) with every
  Ephenia script published elsewhere.
- **The Automation library** — `automation/lib/*.js`, 31 modules concatenated by
  `automation/build.mjs` into `pokeclickerautomation.user.js` at the repo root.
  That bundle is **generated — never edit it by hand**; edit the module under
  `automation/` and rebuild. Upstream is Farigh's `pokeclicker-automation`, ported
  here to a PokéClicker-native interface.
- **The desktop client** — `desktop/app_src/src/` is the source,
  `desktop/app.asar` is the built archive that users actually run. Changing the
  source alone ships nothing.

## Operating principles

- Working code only. Plausible is not correct. Verify before reporting done.
- Never invent a game API, a global, a DOM id, a file path, or command output.
  Read the code or run the command, or say it is unknown.
- Say when a premise looks wrong before implementing around it.
- Touch only what the task requires. No drive-by refactors, reformatting, or
  cleanup of pre-existing code.
- Match the existing pattern in the file you are editing, even when a different
  approach would be nicer in a fresh project.
- Direct and concise. No flattery, no filler.

## Verifying a game API

This is the mistake that costs the most time here. Every module calls PokéClicker
globals — `App.game.*`, `PartyController`, `ItemHandler`, `UndergroundHelpers`,
`BattleCafeController`, `GameConstants` — that are **not declared anywhere in this
repository** and have no type information. A wrong signature fails silently in the
browser, and the jsdom tests will not catch it: `automation/test/gamestub.mjs`
answers *any* property access with a permissive stub.

Before using a game API you have not already seen used in this repo, read it in
the game's own source:

- `https://github.com/pokeclicker/pokeclicker`, branch `develop`
- gameplay systems live under `src/modules/`, older scripts under `src/scripts/`
- the file tree is easiest to search through the GitHub API:
  `https://api.github.com/repos/pokeclicker/pokeclicker/git/trees/develop?recursive=1`

Note the game version the change targets. The current port branch is
`port-v0.10.26`.

## Codebase conventions

**Automation module shape.** One class per file, `AutomationXxx`, all-static, no
instances. Allman braces, 4-space indent, JSDoc `@brief` on every method. Members
meant for other Automation classes take a single `__` prefix; everything private
takes `__internal__`. Two ASCII section banners separate the public interface,
the shared members and the internal members.

**Settings.** Each module declares `static Settings = { Name: "Module-Name" }`.
That string is both the DOM element id and the LocalStorage key — they are the
same thing, `Menu.toggleButtonState` looks the button up by it. Values go through
`Automation.Utils.LocalStorage`, which namespaces per save file
(`Automation-${Save.key}-<key>`) and stores **everything as a string**: always
compare `=== "true"`, never rely on truthiness.

**Wiring a new module** takes three edits, and missing any one of them fails
quietly: the file must be added to `SOURCES` in `automation/build.mjs` in
dependency order, aliased and initialized in `automation/Automation.js`, and — if
it notifies — given a key in `automation/lib/Notifications.js`.

**Defaults.** `Automation.start(true, true)` means every feature *and* every
setting is off by default. `automation/test/init.test.mjs` asserts it. A new
toggle that defaults to on will fail the test suite, and rightly so.

**Standalone userscript headers.** 13 tags, lines 1-19. `@author` credits the
original author and stays as-is; `@copyright`, `@homepageURL`, `@supportURL`,
`@downloadURL` and `@updateURL` point at this repository. Tampermonkey uses
`@updateURL` — a wrong value silently replaces the local script with someone
else's copy.

**Never rename the Ephenia ABI.** `loadEpheniaScript`,
`window.epheniaScriptInitializers`, `AutomationEpheniaControls` and the
`ephenia-mirror-*` / `epheniaControls-*` / `epheniaSettings-*` DOM ids are the
contract with every Ephenia script published outside this repo. The account name
in a *URL* is ours to change; these identifiers are not.

## Commands

```bash
node automation/build.mjs                      # regenerate pokeclickerautomation.user.js
cd automation/test && npm install && npm test  # menu / init / bridges, under jsdom
```

The tests load the **built bundle**, not the sources. Build first or you are
testing the previous version.

There is no root `package.json`, no linter, and no CI. The build and those three
tests are the whole automated gate.

## Verification

- Rebuild and run the three tests after any change under `automation/`.
- After touching `desktop/app_src/src/`, repack `desktop/app.asar` — see the
  `desktop-release` skill. An unrepacked change ships nothing.
- If a check fails, fix the cause. Do not weaken or delete the check.
- Nothing here can be verified in-game from the terminal. For any user-visible
  change, say plainly that in-game verification is still pending rather than
  implying it was done.
