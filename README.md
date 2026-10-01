# **Pokéclicker Scripts**
[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FYggdrasziI%2FPokeclicker-Scripts&count_bg=%23CE4993&title_bg=%23555555&icon=pokemon.svg&icon_color=%23FFD700&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
[![GitHub stars](https://img.shields.io/github/stars/YggdrasziI/Pokeclicker-Scripts?logo=apache%20spark&logoColor=gold)](https://github.com/YggdrasziI/Pokeclicker-Scripts/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/YggdrasziI/Pokeclicker-Scripts?color=%23AA4A44)](https://github.com/YggdrasziI/Pokeclicker-Scripts/issues)
[![GitHub forks](https://img.shields.io/github/forks/YggdrasziI/Pokeclicker-Scripts?color=40826d)](https://github.com/YggdrasziI/Pokeclicker-Scripts/network)

Various scripts & enhancements for the game [Pokéclicker](https://www.pokeclicker.com/).

<hr>

## ⚠️ Read this first

**This repository is a fork** of [Farigh's **pokeclicker-automation**](https://github.com/Farigh/pokeclicker-automation), and changes it. This page describes its **Automation-only** version; the [full version](//github.com/YggdrasziI/Pokeclicker-Scripts) carries more.

**Do not report anything from here to the original author.** Farigh has nothing to do with this fork, and a bug you hit here is far more likely to come from the changes than from the original code. The same goes for the Pokéclicker team: **never** report script problems to the game's developers.

Anything that misbehaves in *this* repository belongs [in this repository's issues](https://github.com/YggdrasziI/Pokeclicker-Scripts/issues).

**Only** use scripts if you have read and understood their descriptions. Back up your save before installing any of them.

<hr>

## Installation

These scripts are written for script manager browser extensions such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), and should work with most others. With one installed, the **One-Click Install** link in each section below is enough.

For the desktop version of the game ([Pokéclicker Desktop](//github.com/RedSparr0w/Pokeclicker-desktop)), replace its <strong>app.asar</strong> with the [modified one from this repository](//github.com/YggdrasziI/Pokeclicker-Scripts/tree/automation-only/desktop); it brings its own script manager, which downloads and updates every script here on its own. Detailed instructions are [here](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/automation-only/desktop/README.md).

This is the version the client downloads with Settings → Scripts → **Scripts version** set to *Automation only*. The One-Click Install link below keeps a browser script manager on this version too.

Development targets PokéClicker **v0.10.26** (branch `port-v0.10.26`).

<hr>

## Upstream project, and what changed here

### Farigh — [pokeclicker-automation](https://github.com/Farigh/pokeclicker-automation)

The whole `automation/` folder, and the [`pokeclickerautomation.user.js`](#automation) bundle it generates. That project is alive and maintained upstream; this is a port of it, not a mirror.

What this fork changed on that side:

* **Bundled instead of loaded.** Upstream fetches each module from GitHub at runtime through its `ComponentLoader`. Here `node automation/build.mjs` concatenates them into one self-contained userscript, so the desktop client works offline and the script behaves like every other script in this repository.
* **New modules:** auto vitamins, click statistics and scheduled save backups (desktop client only).
* **New options** in the existing modules: a Farm Points mode for the farm, automatic Battle Café spinning, Mystery Mine mega-stone hunting, hatchery-helper hiring for the Achievements focus, an Evolution items tab in the auto-shop, an "until shiny" egg mode, automatic Purify Chamber loading, a stuck-quest watchdog, a remaining-evolution count on the Trivia stone tooltips, and a gem-upgrade order that finishes one affinity before starting the next instead of spreading a type's gems thin.
* **A focus fallback chain.** A blocked "Focus on" topic used to switch the whole feature off. It now hands over to up to three fallback topics of your choosing, and comes back on its own once it can make progress again.

The full, phase-by-phase account of these changes is in [`docs/ROADMAP.md`](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/docs/ROADMAP.md).

<hr>

## The scripts


# Scripts
1. [**Automation** ](#automation)
2. [**Script Manager** (Included in desktop/app.asar)](#script-manager)

```diff
- Note: Please backup your saves before using any and all scripts that would be here!!!
- Note: Feel free to open an issue if you find any bugs/issues as these aren't fully tested!!!
- Note: in case it isn't mention below, all user set settings with these scripts are saved and persist even upon game close!!!
```

<hr>

<a name="automation"></a>
## Automation (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/automation-only/pokeclickerautomation.user.js">pokeclickerautomation.user.js</a>) (<a href="//github.com/YggdrasziI/Pokeclicker-Scripts/raw/automation-only/pokeclickerautomation.user.js">One-Click Install</a>)

Farigh's automation suite, bundled into a single file.

It adds an **Automation** card to the game screen. Every feature in it is **off by default** — nothing starts doing anything until you switch it on.

### **Features**

• <strong>Auto attack</strong> — clicks through route, gym, dungeon and temporary battles, at an interval you set, with live click statistics (tick efficiency, click attacks or DPS, how many clicks the current area needs).<br/>
• <strong>Auto fight panels</strong> — gym, dungeon and Battle Frontier panels that appear on the screen they belong to. There is no Safari automation in this version.<br/>
• <strong>Hatchery, Farming, Mining, Auto Shop, Auto Vitamins</strong> — each with its own advanced settings panel.<br/>
• <strong>Oak items and Gems upgrades</strong> — bought automatically as they become affordable.<br/>
• <strong>Focus on</strong> — pick one long-running goal and let it drive: Experience, Money, Dungeon Tokens, gems of any single type, Achievements, Pokérus cure, Quests, Shadow purify, or Alcremie forms (grows the berries, then spins at the Battle Café). If the chosen goal runs out of things to do, it hands over to the fallbacks you picked instead of switching everything off, and takes over again when it can.<br/>
• <strong>Battle Café</strong> — spins for the Alcremie forms you are missing and that the current time of day can actually give.<br/>
• <strong>Max Raid</strong> — in Galar, once the Lair of Giants questline has opened the dens, starts the Max Raid dens open today one after the other, moving you to the den's town first; every win is a Wishing Piece, and losing one turns it off.<br/>
• <strong>Save backups</strong> — desktop client only, since a web page cannot write files. On a schedule you choose, with a retention count. A backup that could not be written, such as to a folder the client may not write to, shows a notification in the game and is tried again every minute.<br/>
• <strong>Notifications</strong> — per feature, so you can hear from the hatchery without hearing from everything else.

### **Building it**

`pokeclickerautomation.user.js` is generated. Edit the modules under `automation/` and run `node automation/build.mjs`; never edit the bundle by hand.

<hr>

<a name="script-manager"></a>
## Script manager (Exclusive to the desktop client) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/automation-only/desktop/">app.asar</a>)

This script provides desktop client support for userscripts, allowing you to run or disable userscripts like a userscript manager browser extension does. All the scripts in this repository are supported and are by default automatically downloaded and updated. It can also run other userscripts that you install. Options are located in the <strong>Scripts</strong> tab in the game's settings menu. 

This script is only compatible with the desktop client. For detailed instructions on installing and using the script manager, see [here](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/automation-only/desktop/).


<hr>

<b>More to be added soon.</b>
