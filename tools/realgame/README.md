# Starting the real game with a script

`start.mjs` loads the PokéClicker build the desktop client runs, injects userscripts
the way the client does, and runs the game's start sequence under jsdom. It is the
closest thing to launching the client, from the terminal, in a few seconds.

```bash
node tools/realgame/start.mjs                                   # the game alone
node tools/realgame/start.mjs shinyvariants customachievements  # with scripts
node tools/realgame/start.mjs shinyvariants --scenario=tools/realgame/scenarios/shinyvariants-save.js
node tools/realgame/start.mjs enhancedautoclicker --save=path/to/backup.txt   # from a save file
```

It exits with 1 and prints the stack when the game cannot start, when a script's
priority function throws, or when the scenario fails.

- **The build** is the one the client downloaded: `%APPDATA%\pokeclicker-desktop\pokeclicker-master\docs`
  (run the client once). `--docs=<dir>` points at another `docs` folder, such as a
  local build of the game.
- **Scripts** are named by their file without `.user.js`, looked up in `custom/` then
  at the root. Their desktop enable flag is set, so they register as they would in
  the client.
- **A save** (`--save=<file>`) starts the game from a save file instead of a fresh
  game: a game export or an Automation backup (the desktop client keeps those under
  `%APPDATA%pokeclicker-desktopsave-backups`), the base64 the game's own
  "load from file" reads. Nothing is written back to the file.
- **A scenario** is a plain script run in the page once the game has started, with
  the game's globals in scope. It sets `window.__scenario` to `true` or `false`;
  `scenarios/` holds the existing ones.

What jsdom cannot do: draw (no canvas), fetch assets, play sounds. The game's
progress lines and settings warnings are filtered out of the output; everything
else the page logs is shown with a `[page]` prefix.
