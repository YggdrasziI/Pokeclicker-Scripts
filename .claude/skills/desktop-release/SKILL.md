---
name: desktop-release
description: Change the modified PokéClicker Electron desktop client under desktop/ - its script manager, download source, settings UI, or version - and repack desktop/app.asar so the change actually ships. Use when asked to modify desktop/app_src, change where the client downloads scripts from, bump the desktop version, or when a desktop change appears to have no effect.
---

# desktop-release

## What ships, and what does not

| Path | Role |
| --- | --- |
| `desktop/app_src/src/main.js` | The source. ~1050 lines, the whole mod. |
| `desktop/app_src/src/scripthandler.js` | Script injection into the game window. |
| `desktop/app_src/package.json` | `"main": "src/main.js"`, dependencies. Upstream is RedSparr0w's client. |
| `desktop/app_src/node_modules/` | Vendored, and **part of the archive**. |
| `desktop/app.asar` | The built archive. **This is the only thing users download.** |
| `desktopupdatechecker.js` | An in-game userscript that nags when the desktop version is stale. |

Users replace the stock `app.asar` in their PokéClicker installation's `resources`
folder with this one (`desktop/README.md`). Editing `app_src/` alone changes
nothing for anyone.

## Repacking

```bash
npx @electron/asar pack desktop/app_src desktop/app.asar
npx @electron/asar list desktop/app.asar | head    # sanity: the archive reads back
```

Never patch the archive with a byte-level substitution. An asar file is a JSON
header of offsets and sizes followed by the concatenated payload; changing a
string's length invalidates every offset after it and the archive stops loading —
with no useful error.

`desktop/app_src/Dockerfile` runs `electron-builder`, which produces full
platform installers, not the bare `app.asar` this repo distributes.
`docker-compose.yml` is empty. Do not reach for Docker for a normal change.

## Version numbers

Two constants must stay equal, and both files say so in a comment:

- `desktop/app_src/src/main.js:38` — `POKECLICKER_SCRIPTS_DESKTOP_VERSION`
- `desktopupdatechecker.js:5` — `LATEST_VERSION`

The update checker compares them as **strings**, so `'2.10.0' < '2.9.0'` is true.
Keep the segments single-digit or fix the comparison deliberately.

Also relevant, and easy to break: `MOD_EXPECTED_CLIENT_VERSION` (`main.js:34`) and
`MOD_EXPECTED_ELECTRON_VERSION` (`main.js:36`) describe the stock client this mod
was built against. They gate the client's own update prompts.

## Where scripts come from

`desktop/app_src/src/main.js:934` holds the single `repoUrl` the client uses:

```js
const repoUrl = 'https://api.github.com/repos/<account>/Pokeclicker-Scripts/contents/';
```

`getRepoContents(repoUrl)` then `getRepoContents(repoUrl + 'custom')` enumerate the
repository, and each file's own `download_url` from the API response is fetched.
There is no per-file URL anywhere else — this one line decides the source for
every script. Two log strings nearby (`:966`, `:973`) name the account too.

Unrelated GitHub URLs in the same file belong to the **game's** updater and must
not be repointed: `main.js:270` (`codeload.github.com/pokeclicker/pokeclicker`)
and `main.js:378` (`raw.githubusercontent.com/pokeclicker/pokeclicker`).

## Safety rules

- Any change under `app_src/` is incomplete until `app.asar` is repacked. Say so
  explicitly if you leave it unpacked.
- Commit `app.asar` in the **same commit** as the `app_src/` change it contains.
  A binary that does not match its source is worse than no binary.
- Check `git status` before repacking. The working tree may already hold a
  repacked `app.asar` ahead of the committed one — repack from the current
  `app_src/`, do not regenerate from `HEAD`.
- `node_modules/` is vendored on purpose. Do not run `npm install`/`npm update`
  there as a side effect; it changes the archive wholesale and hides the real
  diff.
- The client runs Node with full filesystem access. Anything added here is far
  more privileged than a userscript — no shell-outs, no network beyond the two
  existing sources.

## Validation

```bash
npx @electron/asar list desktop/app.asar | head
npx @electron/asar extract-file desktop/app.asar src/main.js   # spot-check the packed source
git diff --stat desktop/                                       # app.asar should move with app_src
```

Then say the runtime check is pending, and name it: launch the client, open
Settings → Scripts, and confirm the log line `Found script files in <account>/Pokeclicker-Scripts/`
plus the expected script list.
