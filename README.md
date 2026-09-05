# **Pokéclicker Scripts**
[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FYggdrasziI%2FPokeclicker-Scripts&count_bg=%23CE4993&title_bg=%23555555&icon=pokemon.svg&icon_color=%23FFD700&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
[![GitHub stars](https://img.shields.io/github/stars/YggdrasziI/Pokeclicker-Scripts?logo=apache%20spark&logoColor=gold)](https://github.com/YggdrasziI/Pokeclicker-Scripts/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/YggdrasziI/Pokeclicker-Scripts?color=%23AA4A44)](https://github.com/YggdrasziI/Pokeclicker-Scripts/issues)
[![GitHub forks](https://img.shields.io/github/forks/YggdrasziI/Pokeclicker-Scripts?color=40826d)](https://github.com/YggdrasziI/Pokeclicker-Scripts/network)

Various scripts & enhancements for the game [Pokéclicker](https://www.pokeclicker.com/).

<hr>

## ⚠️ Read this first

**This repository is a Frankenstein fusion.** It stitches together two unrelated PokéClicker projects — [ephymew's **Pokeclicker Scripts**](https://github.com/ephymew/Pokeclicker-Scripts) and [Farigh's **pokeclicker-automation**](https://github.com/Farigh/pokeclicker-automation) — into one set of scripts, and then changes both of them. The seams show, and they are ours.

**Do not report anything from here to the original authors.** Neither ephymew nor Farigh has anything to do with this fork, and a bug you hit here is far more likely to come from the stitching than from their code. The same goes for the Pokéclicker team: **never** report script problems to the game's developers.

Anything that misbehaves in *this* repository belongs [in this repository's issues](https://github.com/YggdrasziI/Pokeclicker-Scripts/issues).

**Only** use scripts if you have read and understood their descriptions. Back up your save before installing any of them.

<hr>

## Installation

These scripts are written for script manager browser extensions such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), and should work with most others. With one installed, the **One-Click Install** link in each section below is enough.

For the desktop version of the game ([Pokéclicker Desktop](//github.com/RedSparr0w/Pokeclicker-desktop)), replace its <strong>app.asar</strong> with the [modified one from this repository](//github.com/YggdrasziI/Pokeclicker-Scripts/tree/master/desktop); it brings its own script manager, which downloads and updates every script here on its own. Detailed instructions are [here](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/desktop/README.md).

Development targets PokéClicker **v0.10.26** (branch `port-v0.10.26`).

<hr>

## Upstream projects, and what changed here

### ephymew — [Pokeclicker Scripts](https://github.com/ephymew/Pokeclicker-Scripts)

Every standalone `*.user.js` here, the `custom/` folder and the desktop script manager come from that project (published under the **Ephenia** name for most of its life, hence `loadEpheniaScript` and friends throughout the code — that name is a compatibility contract with scripts published elsewhere and is deliberately left alone). This fork branched off its last commit, from May 2025.

Its author has since stepped away from it: he states he is no longer providing support for any of the old scripts, and that the repository will eventually be archived. Work has moved to [**Pokeclicker Scripts Reborn**](https://github.com/ephymew/Pokeclicker-Scripts-Reborn), a from-scratch "V2" — a single unified, modular script rather than a folder of separate ones, rewritten from nothing and explicitly *not* built for compatibility with the old scripts or with anyone's automation. **No release date has been announced**, and the author's own words are "I wouldn't expect much here for a while". Nothing here will follow it automatically; if and when Reborn ships, it will be a different project.

What this fork changed on that side:

* Every `@downloadURL` / `@updateURL` now points at this repository. Left as they were, your script manager would quietly replace these files with the upstream copies.
* **New:** `custom/autonpccodes.user.js` — enters NPC-given redeem codes for you, and lists the ones you have found in the Save / Enter Code screen.
* **New:** `custom/simpletimechanger.user.js` — forces the in-game hour, the way the weather changer forces the weather.
* Enhanced Auto Hatchery only spends eggs that can still give you something, with an "until shiny" mode.
* The fossil revive works outside Kanto: it reads the fossil traders from the game instead of only ever asking Cinnabar Lab.
* The Enhanced Auto Clicker comes back on its own after a Battle Frontier or Safari visit, instead of switching itself off for good.
* Additional Visual Settings: the settings are laid out vertically, and the Shops shortcut became a region-wide item list — every item on sale in the region, in one place, with its price and where to buy it.

### Farigh — [pokeclicker-automation](https://github.com/Farigh/pokeclicker-automation)

The whole `automation/` folder, and the [`pokeclickerautomation.user.js`](#automation) bundle it generates. That project is alive and maintained upstream; this is a port of it, not a mirror.

What this fork changed on that side:

* **Bundled instead of loaded.** Upstream fetches each module from GitHub at runtime through its `ComponentLoader`. Here `node automation/build.mjs` concatenates them into one self-contained userscript, so the desktop client works offline and the script behaves like every other script in this repository.
* **New modules:** auto vitamins, click statistics ported over from the Enhanced Auto Clicker, scheduled save backups (desktop client only), and the two pieces of glue below.
* **`Bridges`** — the two projects automate overlapping things. Turning on a feature that would fight an Ephenia script (two auto-clickers, two miners, two hatcheries) now asks before switching the other one off, in both directions.
* **`EpheniaControls`** — the Ephenia scripts each bury their switches in the screen they act on. Their main switches are mirrored into the Automation card, so everything is reachable from one place; their settings stay where they were, in Settings → Scripts.
* **New options** in the existing modules: a Farm Points mode for the farm, automatic Battle Café spinning, Mystery Mine mega-stone hunting, hatchery-helper hiring for the Achievements focus, an Evolution items tab in the auto-shop, an "until shiny" egg mode, automatic Purify Chamber loading, a stuck-quest watchdog, a remaining-evolution count on the Trivia stone tooltips, and a gem-upgrade order that finishes one affinity before starting the next instead of spreading a type's gems thin.
* **A focus fallback chain.** A blocked "Focus on" topic used to switch the whole feature off. It now hands over to up to three fallback topics of your choosing, and comes back on its own once it can make progress again.

The full, phase-by-phase account of these changes is in [`docs/ROADMAP.md`](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/docs/ROADMAP.md).

<hr>

## The scripts

**Vanilla scripts** are purely for automation or other QoL things.<br>
**Custom scripts** are able to do or change things that aren't within the bounds of the vanilla game, or they may be considered more cheaty.

# Vanilla Scripts
1. [**Automation** ](#automation)
2. [**Additional Visual Settings** ](#additional-visual-settings)
3. [**Auto Battle Frontier** ](#auto-battle-frontier)
4. [**Auto Battle Items** ](#auto-battle-items)
5. [**Catch Filter Fantasia** ](#catch-filter-fantasia)
6. [**Enhanced Auto Clicker** ](#enhanced-auto-clicker)
7. [**Enhanced Auto Hatchery** ](#enhanced-auto-hatchery)
8. [**Enhanced Auto Mine** ](#enhanced-auto-mine)
9. [**Simple Auto Farmer** ](#simple-auto-farmer)
10. [**Script Fixer Upper**](#script-fixer-upper)
11. [**Script Manager** (Included in desktop/app.asar)](#script-manager)
# Custom Scripts
1. [**Auto NPC Codes** ](#custom-auto-npc-codes)
2. [**Auto Quest Completer** ](#auto-quest-completer)
3. [**Auto Safari Zone** ](#auto-safari-zone)
4. [**Catch Speed Adjuster** ](#catch-speed-adjuster)
5. [**Challenge Mode Changer** ](#challenge-mode-changer)
6. [**Debug Cheats Tools** ](#custom-debug-cheats-tools)
7. [**Discord Code Generator** ](#discord-code-generator)
8. [**Infinite Seasonal Events** ](#infinite-seasonal-events)
9. [**Oak Charms** ](#custom-oak-charms)
10. [**Oak Items Unlimited** ](#oak-items-unlimited)
11. [**Omega Protein Gains** ](#omega-protein-gains)
12. [**Overnight Berry Growth** ](#overnight-berry-growth)
13. [**Perky Pokerus Pandemic** ](#perky-pokerus-pandemic)
14. [**Simple Time Changer** ](#custom-simple-time-changer)
15. [**Simple Weather Changer** ](#simple-weather-changer)
16. [**Synthetic Shiny Synapse** ](#custom-synthetic-shiny-synapse)

```diff
- Note: Please backup your saves before using any and all scripts that would be here!!!
- Note: All scripts here are meant to be compatible with one another. Where two of them would
-       genuinely fight over the same thing, the Automation script asks you which one wins.
- Note: Feel free to open an issue if you find any bugs/issues as these aren't fully tested!!!
- Note: in case it isn't mention below, all user set settings with these scripts are saved and persist even upon game close!!!
```

<hr>

<a name="automation"></a>
## Automation (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/pokeclickerautomation.user.js">pokeclickerautomation.user.js</a>) (<a href="//github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/pokeclickerautomation.user.js">One-Click Install</a>)

The largest script here, and the half of the fusion that does not come from the Ephenia project: Farigh's automation suite, bundled into a single file and taught to live alongside the other scripts.

It adds an **Automation** card to the game screen. Every feature in it is **off by default** — nothing starts doing anything until you switch it on.

### **Features**

• <strong>Auto attack</strong> — clicks through route, gym, dungeon and temporary battles, at an interval you set, with live click statistics (tick efficiency, click attacks or DPS, how many clicks the current area needs).<br/>
• <strong>Auto fight panels</strong> — gym, dungeon, Battle Frontier and Safari panels that appear on the screen they belong to.<br/>
• <strong>Hatchery, Farming, Mining, Auto Shop, Auto Vitamins</strong> — each with its own advanced settings panel.<br/>
• <strong>Oak items and Gems upgrades</strong> — bought automatically as they become affordable.<br/>
• <strong>Focus on</strong> — pick one long-running goal and let it drive: Experience, Money, Dungeon Tokens, gems of any single type, Achievements, Pokérus cure, Quests, or Shadow purify. If the chosen goal runs out of things to do, it hands over to the fallbacks you picked instead of switching everything off, and takes over again when it can.<br/>
• <strong>Battle Café</strong> — spins for the Alcremie forms you are missing and that the current time of day can actually give.<br/>
• <strong>Save backups</strong> — desktop client only, since a web page cannot write files. On a schedule you choose, with a retention count.<br/>
• <strong>Notifications</strong> — per feature, so you can hear from the hatchery without hearing from everything else.

### **Living with the other scripts**

Both projects automate overlapping things, and two auto-clickers running at once do not add up. Enabling a feature on either side that conflicts with the other asks you first, then switches the loser off cleanly — including when you click the Ephenia script's own button.

The Ephenia scripts' main switches are also mirrored into an **Ephenia scripts** card, so you do not have to open the Underground to toggle the miner. The mirrors click the real buttons, so the original controls keep working and the conflict prompt still applies. Script settings stay in Settings → Scripts where they have always been; the only things actually moved are the weather and time dropdowns, which their scripts pin to a corner of the town map.

### **Building it**

`pokeclickerautomation.user.js` is generated. Edit the modules under `automation/` and run `node automation/build.mjs`; never edit the bundle by hand.

<hr>

<a name="additional-visual-settings"></a>
## Additional Visual Settings (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/additionalvisualsettings.user.js">additionalvisualsettings.user.js</a>) (<a href="//github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/additionalvisualsettings.user.js">One-Click Install</a>)
This script adds new options to customize the game's graphics alongside a handful of other quality of life features.

### **Visual Settings**

The script's visual settings save on performance by disabling parts of the HTML that can change rapidly. There are settings for route battles, gym battles, dungeons, and the battle frontier. All of them can be found in the Scripts settings tab.

If the Enhanced Auto Clicker script is installed, an additional setting is available to only apply the above visual settings when the autoclicker is running. This lets you improve performance when grinding but still experience the game's graphics the rest of the time.

### **Convenience features**

The script adds various buttons for quicker navigation and quality of life.

• Quick Settings, Inventory, and Pokédex buttons, found to the left of the Start Menu.<br/>
• Quick Dock, Gyms, Dungeons and Shops buttons, found above the Town Map so you don't have to search for them. The Gyms and Dungeons buttons show all in the current region.<br/>
• The Shops button lists every item on sale across the current region in one place, so you can find an evolution stone or an egg without opening each shop in turn. An item sold in several towns is listed once, with its price and where to buy it; clicking it takes you there and opens the shop. Only unlocked towns and items you have unlocked are shown, so everything in the list is something you can actually buy.<br/>
• Optimize vitamins buttons, found in the all vitamins menu. This feature uses the optimal combination of vitamins for your current region on the pokemon you select (assuming you have enough). It looks like a set of scales: ⚖

<hr>

<a name="auto-battle-frontier"></a>
## Auto Battle Frontier (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/autobattlefrontier.user.js">autobattlefrontier.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/autobattlefrontier.user.js">One-Click Install</a>)
This script adds in a stage resetter to the Battle Frontier.<br>

![](https://github.com/Ephenia/Pokeclicker-Scripts/assets/12092270/3e2200c4-294d-4a9f-9351-b03ff0d2bd96)

You can specify a maximum stage in the input box on the right. When you complete that stage, you will earn the Battle Points and money for failing the stage, and then restart from the beginning. This allows you stay inside the Battle Frontier indefinitely farming BP while fully AFK.

The Max Attacks mode restarts the Battle Frontier when you reach a stage with battles that you cannot defeat in the specified number of attacks, allowing you to loop through the early stages for quicker farming. The button toggles through 1 attack, 2 attacks, and disabling the mode. Max Attacks is an enhancement of the previous One Click mode: the two-attack mode is slightly more efficient for farming BP.

<hr>

<a name="auto-battle-items"></a>
## Auto Battle Items (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/autobattleitems.user.js">autobattleitems.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/autobattleitems.user.js">One-Click Install</a>)
This script adds in automation for Battle Items:<br>

![image](https://user-images.githubusercontent.com/26987203/178172097-3f733731-a15d-4ed9-b82a-f8476a39a4ff.png)

It's quite simple how it works, and this also aims to be efficient as possible.

You can click the area of the specific Battle Item's quantity to toggle its automation. By default, they are all red, but when toggled on they will turn green.

When active, Battle Items will be bought as long as you've unlocked the earliest Town Shop that sells said Battle Items, also if you currently possess an exact quantity of 0 of them as well. Battle items will also only be bought when there is no price penalty involved with them. This means you would need to be battling Pokémon to keep the base price of them down.

Battle Items will automatically be used when you have at least 1 available, as you would expect.

<hr>

<a name="catch-filter-fantasia"></a>
## Catch Filter Fantasia (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/catchfilterfantasia.user.js">catchfilterfantasia.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/catchfilterfantasia.user.js">One-Click Install</a>)
So, this script would be adding a Filter button to the Pokeballs section:

![image](https://user-images.githubusercontent.com/26987203/170853489-de1f9304-9a91-45d1-aa0e-904f5c1709ed.png)

When you open the Filter, it will bring you to the all brand new Catch Filter:

![image](https://user-images.githubusercontent.com/26987203/170853561-4d0fe3e0-73e7-4dee-af93-cd50c69ccdde.png)

So, how this works is when you have the Catch Filter on, basically the Catch Filter would somewhat be overriding the normal ball selection that you'll find (as shown in the 1st screenshot) and what we've always been used to.

You can now better think of the normal ball selection as a "default" ball selection for things when you have the Catch Filter active.

Now, to start using the Catch Filter, it should be pretty easy and straight forward.

You can start typing a Pokémon's name (can be case-insensitive) that you'd like to filter, like so:

![image](https://user-images.githubusercontent.com/26987203/170853705-8798099c-ae29-42f1-a775-8d1864640ee0.png)

To filter a Pokémon, you can click on them:

![image](https://user-images.githubusercontent.com/26987203/170853732-86a3adbd-4a37-4557-bced-1ab5f7cb134c.png)

The green indicates that they are filtered. When a Pokémon is filtered, **that means that they are allowed to be caught**.

To the right, you will see 2 Pokéballs.

When they are blank (default), then the Pokéballs being used to capture their normal and shiny variation will be set to whatever you have as a default selection normally (as shown in the 1st screenshot).

The left Pokéball is for the normal variation of the specified Pokémon.

The right Pokéball is for the shiny variation of the specified Pokémon.

To select the Pokéball you want to capture the specified Pokémon, you must click the Pokéball. Clicking the Pokéball will cycle through all the available Pokéballs. Right-clicking the Pokéball will also reset/clear it back to default, that's if you don't cycle through all the options by clicking or don't want to.

Here's an example:

![image](https://user-images.githubusercontent.com/26987203/170853904-ed1d86de-0dc2-4b48-b60d-859bcdb5aff0.png)

Here I have normal Eevees encountered set to be caught with normal Pokéballs, however if a shiny Eevee appears, then it will be attempted to be caught with an Ultra Ball.

Remember, this will only work if the Catch Filter is on AND it is highlighted green. Simple and straight forward, yes? Good.

Now, there are type catching filters:

![image](https://user-images.githubusercontent.com/26987203/170853970-a1c50d8c-3f47-4cc4-ae9b-218d6578cf2a.png)

If you turn these on, then Pokémon that match the specified type(s) will be caught. Yes, both single and dual typing Pokémon are accounted for here. So, for example, if you have only the Flying type filter on, then a Pidgey will still get caught because one of its types just so happens to be Flying type.

Now, an important thing to note. This is **VERY** important.

**When you have the type filters on, these type filters will ignore Pokémon that you have filtered or not regardless. That's if the typing(s) are matching said Pokémon.**

**On top of that, if you have any Pokéballs specified on Pokémon in your filters, then these Pokémon will be attempted to be caught using the balls that you have set on them.**

**This means that you should be mindful of what Pokéballs that you're setting specifically on specific Pokémon.**

Another thing to know too, is if you set a Pokéball that you have 0 quantity of to a Pokémon to be caught with, then the Pokéball that they will be caught with will resort to what you have set to as default settings (as shown in the 1st screenshot).

I think this would cover mostly everything, but if there are any other questions too, then I can answer them.

I think the rest of the buttons there are self-explanatory, and you guys can have fun testing that stuff out and playing around with it.

<hr>

<a name="enhanced-auto-clicker"></a>
## Enhanced Auto Clicker (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/enhancedautoclicker.user.js">enhancedautoclicker.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/enhancedautoclicker.user.js">One-Click Install</a>)

This script is based on one originally created by <b>Ivan Lay</b>, which [can be found here](https://github.com/ivanlay/pokeclicker-automator). 

<img width="608" src="https://user-images.githubusercontent.com/12092270/283228302-872fd66d-e8e8-488c-afdd-e9b8ef550d77.png">

The main Auto Clicker button can be found under your currencies. Clicking it toggles the Auto Clicker on/off without the need of a refresh. This setting will also save and persist through page refresh/close.

You can also adjust the number of clicks made per second. Higher click rates still max out at 20 enemies defeated per second, as the Auto Clicker makes multiple clicks simultaneously to reduce lag. Please note that while older script versions allowed you to set the Auto Clicker to up to 1000 clicks per second, this setting and its resulting click measurements <strong>were not</strong> accurate. The game engine cannot support speeds that high and the current version should provide similar performance.

The Auto Clicker button displays various statistics while running:<br>

<strong>• Clicker Efficiency</strong> - How close the Auto Clicker is to its maximum speed. The closer to 100%, the better.<br>
<strong>• Clicks/s</strong> or <strong>DPS</strong> - The number of clicks per second or click damage per second the Auto Clicker is producing.<br>
<strong>• Req. Clicks</strong> or <strong>Req. Click Damage</strong> - The number of clicks or click attack necessary to one-shot enemies in the current route, gym, or dungeon. The color changes depending on whether you meet the requirement. This ignores dungeon boss health and health bonuses from dungeon chests.<br>
<strong>• Enemy/s</strong> - How many enemies you are defeating per second.<br>

You can switch between clicks and damage display modes in the settings menu. Statistics are averaged over the last ten seconds, reset upon changing locations.

### **Auto Gym**

The Auto Gym feature is found below the Auto Click button. Some notes about how this works:

• Auto Gym will only work while the Auto Clicker is active.<br>
• Auto Gym when activated will automatically fight the Gym in the town you are in.<br>
• There is a dropdown to the right of the Auto Gym button which is meant for Elite Fours and other towns with multiple gyms. The number that you set this to determines which gym or Elite Four member you will fight. For example, if you set it to #5 while at a Pokemon League, you will fight the Champion. However, if you set Auto Gym to fight a gym you have not yet unlocked, you will instead end up fighting the last unlocked gym in that town (if one exists) until you restart Auto Gym or select a different gym to fight. 

### **Auto Dungeon**

The Auto Dungeon feature is found below the Auto Click button. Some notes about how this works:

• Auto Dungeon will only work while the Auto Clicker is active.<br>
• Auto Dungeon when activated will automatically explore the current dungeon, or begin exploring a dungeon whose entrance you are at.<br>
• If Flash is unlocked for a dungeon, Auto Dungeon will use it to explore more efficiently.<br>
• If the settings menu option "Auto Dungeon finishes dungeons before turning off" is enabled (as is default), Auto Dungeon will not immediately stop when toggled off. It will finish exploring the current dungeon and stop after defeating the boss. Clicking the Auto Dungeon button a second time will stop it immediately without finishing the dungeon.<br>
• The two buttons to the right of the Auto Dungeon button control its modes.<br>
&emsp;&emsp;• When fights mode is on, Auto Dungeon will find and fight every enemy on the floor.<br>
&emsp;&emsp;• When chests mode is on, Auto Dungeon will find every chest on the floor and open them before fighting the boss.<br>
&emsp;&emsp;• When neither mode is on (both buttons are greyed out), Auto Dungeon will just find and fight the boss as quickly as possible.<br>
• The dropdown menu determines which chests Auto Dungeon will open. It will only open chests of the selected rarity or higher.<br>
&emsp;&emsp;• If the settings menu option "Always open visible targeted chests" is enabled, Auto Dungeon will open chests of sufficient rarity even when chests mode is off. It will open any visible chests right before fighting the boss but not explore the floor to reveal potential other chests.<br>

<hr>

<a name="enhanced-auto-hatchery"></a>
## Enhanced Auto Hatchery (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/enhancedautohatchery.user.js">enhancedautohatchery.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/enhancedautohatchery.user.js">One-Click Install</a>)
This script is based on one created by <b>Ivan Lay & Drak</b> which [can be found over here](//greasyfork.org/en/scripts/432768-auto-hatchery-edit-pokeclicker-com).

The Auto Hatchery automatically hatches eggs and places new eggs/fossils in the hatchery. 

![](https://i.imgur.com/VpL6TTr.png)

This button on the main-screen hatchery display toggles the Auto Hatchery.

![](https://github.com/Ephenia/Pokeclicker-Scripts/assets/12092270/acc89fd5-c559-4e21-a86b-ff2661f7bf3d)

These buttons inside the hatchery control the various Auto Hatchery modes, which activate in the following order.

• PKRS Mode tries to spread Pokerus. If you have an uninfected pokemon and a contagious pokemon that share a type, it will put them in the hatchery together.<br/>
• Auto Egg hatches eggs (the items), if you have any. An egg is only spent while it can still hatch a pokemon you are missing, so eggs whose pokemon you have all caught are left in your bag. When in Shiny Eggs mode, it keeps spending those eggs until every pokemon they can give is shiny. Only the pokemon reachable in the regions you have unlocked count, since those are the only ones an egg can produce; a Mystery Egg counts every egg type, because it rolls one at random when it hatches.<br/>
• Auto Fossil revives fossils, if you have any. When in Shiny Fossils mode, it will ignore fossils for which you already have the corresponding shiny.<br/>

If none of the above modes are enabled or have targets, the Auto Hatchery will select the first pokemon (in hatchery sort order) that matches your hatchery filters. If none match, it will select the first possible pokemon.

<hr>

<a name="enhanced-auto-mine"></a>
## Enhanced Auto Mine (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/enhancedautomine.user.js">enhancedautomine.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/enhancedautomine.user.js">One-Click Install</a>)
This script was originally created by <b>Ivan Lay</b> and [can be found over here](//github.com/ivanlay/pokeclicker-automator).

This I had worked quite a bit on, and I'm quite happy with what it's capable of doing. This is far bigger and does a lot more than Ivan Lay's script. However, since I was using it and was inspired, I decided to make an auto miner that's as efficient as possible instead.

What this script adds is a new top row below the mining layer, as shown:<br>

![](https://user-images.githubusercontent.com/12092270/184208280-9ef59caf-5b0f-402a-be12-049cdad8beb3.png)

There's a lot to go over and explained with this Auto Miner, but I'll try my best to explain it all:

**• Auto Mine** - This will turn the Auto Miner On/Off. The Auto Miner uses bombs to automatically mine.<br>
**• Auto Small Restore** - This will automatically buy and use Small Restores when low on energy (only while Auto Mine is running). It will only buy them when there are no Restores in your inventory and when they cost 30,000 (base price). Knowing that, this is best used anywhere you can one-shot Pokémon, so the price penalty in the Shop is constantly decreasing.<br>
**• 1st Input Field** - The money amount below which the script will stop auto-buying Small Restores, so it won't drain all your money.<br>
**• Dropdown Menu** - This menu lets you choose a type of item for the Treasure Hunter mode. While you have skips available, the Treasure Hunter will survey layers and skip them if they contain too few of your desired item type. The Treasure Hunter's default setting skips layers with too few total items.<br>
**• 2nd Input Field** - The minimum number of your desired item type (or total items) for the Treasure Hunter. If the layer has fewer of the set item type the Treasure Hunter will skip it. Set this field to 0 to not skip any layers.<br>

As of 1.1 this also includes 2 more additional features into the Treasures tab of the Underground as shown below:<br>

![](https://i.imgur.com/H0btTjL.png)

<strong>• Auto Sell Treasure</strong> - This will automatically sell any and all treasures that would give you Diamonds upon successfully mining an Underground layer.<br>
<strong>• Auto Sell Plate</strong> - This will automatically sell any and all plates that would give you gems upon successfully mining an Underground layer.

```diff
- Note: the Auto Miner runs once every 1 second.
```

<hr>
  
<a name="simple-auto-farmer"></a>
## Simple Auto Farmer (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/simpleautofarmer.user.js">simpleautofarmer.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/simpleautofarmer.user.js">One-Click Install</a>)
This script is a simple Auto Farmer which adds 4 new buttons below the Plant and Harvest all buttons as shown:<br>

![](https://i.imgur.com/ei7lR95.png)

• Auto Farm will plant the berry that you have selected.<br/>
• Auto Harvest will harvest all ripe berries.<br/>
• Auto Replant will wait for ripe berries to be close to withering before harvesting, then replant the same kind of berry in that plot. This can be especially useful for mutating berries.<br/>
• Auto Mulch will wait for mulch to be close to running out, then use the same kind of mulch on that plot.

The Auto Farmer runs even while the farm window is closed. It also now saves your berry selection when the game restarts, to avoid farming interruptions.

```diff
- Note: the Auto Farmer runs once every 1 second.
- Note: Auto Replant cannot be used alongside Auto Plant or Auto Harvest.
```

<hr>

<a name="script-fixer-upper"></a>
## Script Fixer Upper (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/scriptfixerupper.user.js">scriptfixerupper.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/scriptfixerupper.user.js">One-Click Install</a>)

This script resets the settings of all your other installed scripts. It is intended **only** for troubleshooting and fixing buggy behavior, as described [here](https://github.com/ephymew/Pokeclicker-Scripts/issues/214).

When you open the game with this script installed, it will bring up a confirmation box asking if you are sure you want to proceed. Confirming will remove **all** non-game data from localStorage, including any data from other people's scripts. While this should not affect your save data, you should make backups first just to be safe.

This script should be your first step if you are experiencing bugs, especially after a script update. Otherwise you should **never** have this script enabled. Asking about a pop-up that resets your scripts is a clear sign of using scripts without first checking what they do! Don't do this!

<hr>

<a name="script-manager"></a>
## Script manager (Exclusive to the desktop client) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/desktop/">app.asar</a>)

This script provides desktop client support for userscripts, allowing you to run or disable userscripts like a userscript manager browser extension does. All the scripts in this repository are supported and are by default automatically downloaded and updated. It can also run other userscripts that you install. Options are located in the <strong>Scripts</strong> tab in the game's settings menu. 

This script is only compatible with the desktop client. For detailed instructions on installing and using the script manager, see [here](//github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/desktop/).

<img width="840" alt="Script manager options" src="https://github.com/Ephenia/Pokeclicker-Scripts/assets/12092270/dc19411e-c565-48cb-8be6-6ac9b8abe17b">

<hr>

<a name="auto-quest-completer"></a>
## [Custom] Auto Quest Completer (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/autoquestcompleter.user.js">autoquestcompleter.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/autoquestcompleter.user.js">One-Click Install</a>)
This script automatically completes and starts quests and can be toggled with this button:<br>

![image](https://i.imgur.com/3AYaNes.png)

The script now has settings in the Settings menu that let you customize its behavior.

• <strong>Max quest slots</strong> — Overrides the number of quests you can have active simultaneously, anywhere from just 1 to all 10 quests.</br>
• <strong>Quest reset timer</strong> — Choose a period of time (in minutes) to refresh your quests after if any are incomplete. Turn the timer on and off with the button at the bottom of the quest display.
• <strong>Preferred quest types</strong> — Choose which quest types to prioritize. The script will automatically refresh your quests if all current preferred quests have been completed, though it will claim any unpreferred quests that happen to complete. If you are using fewer than 10 quest slots, prioritized quests will be selected first.

<hr>

<a name="auto-safari-zone"></a>
## [Custom] Auto Safari Zone (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/autosafarizone.user.js">autosafarizone.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/autosafarizone.user.js">One-Click Install</a>)

This script automatically explores the Safari Zone and Friend Safari, catching Pokémon and collecting items for you. You can activate the script while in the window for either Safari.

The script also has the following options:
<strong>• Auto Pick Items</strong> - Pick up items when only one ball is left (enabled by default)
<strong>• Auto Throw Bait</strong> - Throws berries when seeking uncaught or contagious Pokémon, or regular bait if you need a bait achievement. 
<strong>• Auto Seek New</strong> - Prioritizes catching uncaught Pokémon.
<strong>• Auto Seek PKRS</strong> - Prioritizes catching contagious Pokémon (below 50 EVs).
<strong>• Auto Fast Anim</strong> - Increases the speed of many animations. Stacks with the Safari Level speed bonuses.

The auto bait setting will never use your last berry. The script will always use optimal berries to catch shiny Pokémon, whether or not auto bait is enabled.

<hr>

<a name="catch-speed-adjuster"></a>
## [Custom] Catch Speed Adjuster (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/catchspeedadjuster.user.js">catchspeedadjuster.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/catchspeedadjuster.user.js">One-Click Install</a>)
This script adds in a new option found below your Pokéballs:<br>

![image](https://i.imgur.com/C6aVzND.png)

This currently will make all of your Pokéballs catch Pokémon at 0 delay (basically catch Pokémon as fast as you can defeat them).

<hr>

<a name="challenge-mode-changer"></a>
## [Custom] Challenge Mode Changer (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/challengemodechanger.user.js">challengemodechanger.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/challengemodechanger.user.js">One-Click Install</a>)
This script changes how Challenges work:<br>

![image](https://i.imgur.com/zsPsiSg.png)

This makes it so that you can click the actual buttons and makes them able to enable/disable their respective challenges.

Most of the Challenges should update and take immediate effect. However, there may be wonky and unexpected side effects with certain Challenges, as this would still need testing and this is new to us all.

Also, yes, changing these will give you the respective Challenge ribbons on your player card or remove them. It's no different from activating Challenges on a completely fresh save.

<hr>
  
<a name="custom-debug-cheats-tools"></a>
## [Custom] Debug Cheats Tools (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/debugcheatstools.user.js">debugcheatstools.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/debugcheatstools.user.js">One-Click Install</a>)
This script adds a <strong>Debug Cheats</strong> entry at the top of the Start Menu, opening a panel that writes straight into your save.

From it you can grant yourself any amount of each currency, gem, pokéball, berry, evolution item, vitamin and held item, and catch any pokémon from a filterable Pokédex list — clicking a pokémon catches it, clicking it again makes it shiny. A second tab lists your quest lines and their state, for reading only.

There is no undo and nothing here is subtle. It exists for testing and for repairing a broken save; using it on a save you care about is entirely at your own risk. Back it up first.

<hr>

<a name="discord-code-generator"></a>
## [Custom] Discord Code Generator (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/discordcodegenerator.user.js">discordcodegenerator.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/discordcodegenerator.user.js">One-Click Install</a>)
This script will let you generate infinite amounts of Discord codes for all of the exclusive Pokémon locked behind Pokéclicker's Discord bot:<br>

![image](https://i.imgur.com/5Agit4Q.png)

You can claim as many Pokémon as you want just by clicking buttons, and they are also generated no differently than normal.
  
This also would **NOT** require you to link up a Discord account (for those without an account or prefer to not use Discord).

This script also works while offline.

<hr>

<a name="custom-auto-npc-codes"></a>
## [Custom] Auto NPC Codes (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/autonpccodes.user.js">autonpccodes.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/autonpccodes.user.js">One-Click Install</a>)
Some NPCs give you a redeemable code in their dialogue, which you then have to copy into Start Menu &rarr; Save / Enter Code by hand. This script enters them for you and notifies you when it does, naming the code and the NPC who gave it.

Nothing is granted for free: a code is only entered once you have actually opened that NPC's dialogue. The game does not record having talked to these particular NPCs, so the script keeps its own list of the codes you have been shown, separately for each save file. If you already talked to an NPC before installing this, go and talk to them once more.

A code you were given before you could use it is remembered and entered later, once the game lets you claim it. Nothing is ever entered twice.

The codes you have found are listed in Start Menu &rarr; Save / Enter Code, just under the box where codes are normally typed, each showing what it gives and whether it has been entered or is still waiting on something. Below the list is a count of how many of the game's codes you have claimed in total &mdash; that count includes the ones no NPC hands out, so it can be ahead of the list.

Note that one of the codes refunds unused vitamins and asks you to confirm before it applies, so a confirmation box will appear when that code is entered.

<hr>
  
<a name="infinite-seasonal-events"></a>
## [Custom] Infinite Seasonal Events (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/infiniteseasonalevents.user.js">infiniteseasonalevents.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/infiniteseasonalevents.user.js">One-Click Install</a>)
This script adds in a new settings option to the top of the Start Menu:<br>

![image](https://user-images.githubusercontent.com/26987203/139570136-78e45d86-97ce-4fec-aa31-3459fbf19e04.png)

This will give you access to all of the seasonal events in the game:<br>

![image](https://user-images.githubusercontent.com/26987203/139570151-70f47769-40b1-4ec4-aa15-9eac50f33b39.png)

The events also show all the Pokémon that are brought along with them.

You can click on them to start any event that you desire. You are also able to activate more than 1 event simultaneously. They can be toggled on or off at any time. These events will run basically without end, at least not ending at any time you would really have to worry about.

There may be some other cool or neat custom events added in with this as well.

<hr>

<a name="custom-oak-charms"></a>
## [Custom] Oak Charms (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/oakcharms.user.js">oakcharms.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/oakcharms.user.js">One-Click Install</a>)
This script adds three Oak Items to the game's own Oak Items window. Each one multiplies a currency the way the Amulet Coin multiplies Pokédollars, takes one of your Oak Item slots like any other item, and shows up with that currency's icon since the game has no sprite for it. All three level up from the Oak Items window for a Pokédollar upgrade cost, once they have earned enough experience by being used.

<strong>Quest Charm</strong> multiplies the Quest Points you gain from quests. It unlocks when you reach Johto, and gains 1 experience each time it multiplies a quest reward.

| Level | Bonus | Quests claimed (total) | Upgrade cost |
|:-----:|:-----:|:----------------------:|:------------:|
| 0 | ×1.25 | – | 1,000,000 |
| 1 | ×1.30 | 10 | 2,500,000 |
| 2 | ×1.35 | 100 | 5,000,000 |
| 3 | ×1.40 | 250 | 10,000,000 |
| 4 | ×1.45 | 500 | 20,000,000 |
| 5 | ×1.50 | 1,000 | – |

<strong>Farm Charm</strong> multiplies the Farm Points you gain from harvesting berries and from wandering Pokémon. It unlocks once you have unlocked 5 berries, and gains 1 experience per Farm Point received while equipped.

| Level | Bonus | Farm Points obtained (total) | Upgrade cost |
|:-----:|:-----:|:----------------------------:|:------------:|
| 0 | ×1.25 | – | 75,000 |
| 1 | ×1.30 | 1,000 | 150,000 |
| 2 | ×1.35 | 10,000 | 375,000 |
| 3 | ×1.40 | 25,000 | 750,000 |
| 4 | ×1.45 | 100,000 | 1,500,000 |
| 5 | ×1.50 | 250,000 | – |

<strong>Battle Charm</strong> multiplies the Battle Points awarded at the end of a Battle Frontier run. It unlocks once you own Deoxys, the stage 100 reward of the Battle Frontier, and gains 1 experience per Battle Frontier stage completed while equipped.

| Level | Bonus | Stages completed (total) | Upgrade cost |
|:-----:|:-----:|:------------------------:|:------------:|
| 0 | ×1.25 | – | 10,000,000 |
| 1 | ×1.35 | 500 | 25,000,000 |
| 2 | ×1.50 | 1,000 | 50,000,000 |
| 3 | ×1.60 | 2,500 | 100,000,000 |
| 4 | ×1.75 | 5,000 | 500,000,000 |
| 5 | ×2.00 | 25,000 | – |

The items are stored in your save under their own keys, which the unmodified game simply ignores, so a save touched by this script still loads without it. Rewards that bypass bonuses in the base game, such as flat questline rewards, stay flat here too.

Known quirks: the quest completion message and its logbook entry print the base reward while the wallet receives the multiplied amount (the Battle Frontier result shows the real figure); the "all quests completed" bonus and the Farm Points from redeem codes are multiplied as well; and a max-level charm counts toward the "max level Oak Item" achievements.

<hr>

<a name="oak-items-unlimited"></a>
## [Custom] Oak Items Unlimited (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/oakitemsunlimited.user.js">oakitemsunlimited.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/oakitemsunlimited.user.js">One-Click Install</a>)
This script removes the limit for the amount of Oak Items that you're able to equip:<br>

![image](https://i.imgur.com/0Peh94W.png)

All items are able to work together just fine, including leveling simultaneously with each other. Also, this is fully compaitable and functional with Loadouts.

This also removes any requirements needed to unlock any Oak Item slots, meaning you get the max number of slots given to you on a fresh save.

<hr>

<a name="omega-protein-gains"></a>
## [Custom] Omega Protein Gains (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/omegaproteingains.user.js">omegaproteingains.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/omegaproteingains.user.js">One-Click Install</a>)
This script removes the limit for the amount of Proteins that you're able to use on Pokémon:<br>

![image](https://i.imgur.com/2kXCzUA.png)

I haven't tested the limits of how many Proteins you can give, but it should practically be infinite.

<hr>

<a name="overnight-berry-growth"></a>
## [Custom] Overnight Berry Growth (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/overnightberrygrowth.user.js">overnightberrygrowth.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/overnightberrygrowth.user.js">One-Click Install</a>)
This script allows berries to grow while the game is closed, simulating their growth when the game loads. No mutations occur, aside from Kebia replanting, and Farm Hands are not active. Withered berries can replant as normal, but the script will ignore replanted berries to avoid lag. You can choose between three modes in the settings: 

- Until ripe: Berries will only grow until they are ripe and no time will pass for already-ripe berries. The default mode.
- Until withered: Berries will continue aging once they are ripe and may wither.
- Harvest before withering: Berries will continue aging once they are ripe, but the script harvests berries right before they would wither (during offline growth only).

<hr>

<a name="perky-pokerus-pandemic"></a>
## [Custom] Perky Pokerus Pandemic (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/perkypokeruspandemic.user.js">perkypokeruspandemic.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/perkypokeruspandemic.user.js">One-Click Install</a>)
This script makes Pokérus spread inside the Hatchery without needing your Starter Pokémon inside for this to be accomplished.

This script will run and work automatically without needing to do anything else.

<hr>

<a name="simple-weather-changer"></a>
## [Custom] Simple Weather Changer (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/simpleweatherchanger.user.js">simpleweatherchanger.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/simpleweatherchanger.user.js">One-Click Install</a>)
This script lets you freely edit the weather of the region you are currently in with this button:<br>

![image](https://i.imgur.com/2cBIfyH.png)

In addition it will also prevent the weather from changing and will remember you choice when reloading the game

<hr>

<a name="custom-simple-time-changer"></a>
## [Custom] Simple Time Changer (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/simpletimechanger.user.js">simpletimechanger.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/simpletimechanger.user.js">One-Click Install</a>)
This script adds a dropdown next to the weather selector that forces the in-game hour, or leaves it following your computer clock.

Everything that depends on the time of day follows it: the day cycle indicator, time-locked evolutions, and which Alcremie forms the Battle Cafe can give you. Only the hour is forced, so minutes and seconds keep running normally, and the setting persists across reloads.

If the Automation script is installed, this dropdown and the weather one are moved together into a "Time and weather" section of its Ephenia scripts card, instead of sitting in a corner of the town map.

<hr>

<a name="custom-synthetic-shiny-synapse"></a>
## [Custom] Synthetic Shiny Synapse (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/blob/master/custom/syntheticshinysynapse.user.js">syntheticshinysynapse.user.js</a>) (<a href="https://github.com/YggdrasziI/Pokeclicker-Scripts/raw/master/custom/syntheticshinysynapse.user.js">One-Click Install</a>)
This script adds a <strong>Shiny Modifier</strong> entry at the top of the Start Menu, opening a table of every way the game can roll a shiny — wild, dungeon, evolution stone, safari, gift/claimed, hatchery and wandering/farm pokémon — with the odds it uses for each.

Each row can be given its own odds, or you can set a single global rate that overrides all of them at once. The table also shows what the shiny charm bonus turns each figure into, so you can see the number the game will actually roll against.

<strong>Karma Mode</strong> replaces all of that with a pity counter: the odds improve by one on every failed roll and snap back to the game's own rate the moment a shiny appears, so a dry streak cannot last forever. While it is on, the manual rates are locked.

<strong>DOM Updates</strong> refreshes the table live as rolls happen, which is useful for watching karma mode work and pointless otherwise.

<hr>

<b>More to be added soon.</b>
