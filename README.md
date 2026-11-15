# ☀️ Wolkenhüpfer

**A colorful, kid-friendly side-scrolling adventure — built with plain HTML, CSS, and JavaScript.**

Hop across ten themed worlds, collect stars, jump on little enemies, and find your way to the flag. Start with five lives, discover helpful power-ups, and take on increasingly challenging jumps, moving platforms, and themed obstacles.

No installation, build tools, or backend required. Open the game in your browser and press **Enter** to begin!

> The game's interface is currently in German. This README explains the controls and features in English.

## Play locally

1. Clone or download this repository. If you download a ZIP, extract it first.
2. Open **`index.html`** in a modern browser.
3. Press **Enter** or click **“Los geht’s”** to start.

Keep `index.html`, `style.css`, and `game.js` together in the same folder. Node.js is only needed for the optional development checks below.

## Controls

| Input | Action |
| --- | --- |
| **← / →** | Move left / right |
| **Space** or **↑** | Jump |
| **Enter** | Start the game, continue to the next world, or restart after game over |
| **P** | Pause / resume |
| **F** | Expand / restore the game to fill the browser window |
| **Escape** | Leave the expanded view |
| **♫ button** | Enable / disable sound effects |

On-screen movement and jump buttons are available on smaller screens.

### Just want to jump?

Enable **“Automatisch laufen”** below the game to run right automatically. You can focus on timing your jumps, and still hold **←** to go back and reach a return platform.

## What awaits you

- **Ten distinct worlds:** sunny meadows, mushroom forests, floating islands, desert ruins, snowy landscapes, crystal caves, and more.
- **A gentle beginning:** the first world has no solid obstacle blocks. Later worlds add more obstacles, stacks, and elevated jumping routes.
- **Themed obstacles:** mushrooms, sandstone blocks, ice, coral, crystals, glowing volcanic rock, and cloud structures.
- **Moving platforms and animated spikes:** the outer spikes move together while the middle spike moves in the opposite direction. Their collision shapes follow the animation.
- **A little ice physics:** Frostfunkeln adds gentle acceleration, braking, and sliding.
- **Distinct late-game finales:** ice ridges, coral arches, an L–T–L cave puzzle, basalt steps, and a cloud crown.
- **A way back up:** marked return platforms help you recover after missing an elevated jump.
- **Checkpoints and a friendly life-loss animation:** a brief hop and a swirl of stars before returning to your checkpoint.
- **Optional sound effects** and an expanded browser-window view.

## Power-ups and lives

| Symbol | Power-up | Effect |
| --- | --- | --- |
| ◆ | Shield | Absorbs one enemy or spike hit. It does not protect against falls or lava. |
| ↑ | Jump boost | Jump higher for 15 seconds of active play. |
| ♥ | Extra life | Adds one life, even when you already have five or more. |

You start each new game with **five lives**. Collect stars along the way and jump onto enemies from above to defeat them. Reach the flag to finish a world, then press **Enter** to continue. Lives carry over between worlds; starting a new game resets your progress.

## The ten worlds

| World | In-game name | Setting |
| --- | --- | --- |
| 01 | Sonnenwiese | A cheerful meadow to learn the basics |
| 02 | Pilzwald | A mushroom forest with mushrooms to jump over |
| 03 | Wolkeninseln | Floating islands and cloud obstacles |
| 04 | Wüstenzauber | A warm desert with sandstone ruins |
| 05 | Sternental | A starry valley with moonstone blocks |
| 06 | Frostfunkeln | Snow, ice blocks, and slippery movement |
| 07 | Korallenküste | A seaside world with coral obstacles |
| 08 | Kristallhöhle | Glowing crystals and an L–T–L platform puzzle |
| 09 | Glut-Unterwelt | A dark cavern with lava, embers, and volcanic rock |
| 10 | Himmelsreich | Rainbows, clouds, and a final climb through the sky |

## Publish with GitHub Pages

The game is a static website and can be hosted directly with GitHub Pages.

1. Push the project to your GitHub repository, keeping `index.html`, `style.css`, and `game.js` at the repository root.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment → Source**, select **Deploy from a branch**.
4. Choose **main** (or the branch containing your game) and **/(root)**, then click **Save**.
5. Once deployment finishes, open the site link shown on that page and share it with other players.

For a project repository, the address typically follows this pattern:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

With GitHub Free, use a public repository. See the [GitHub Pages setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) for details. Subsequent pushes to the publishing branch update the hosted game automatically.

## Project structure

```text
.
├── index.html          # Page layout, game canvas, and controls
├── style.css           # Responsive styling and expanded view
├── game.js             # Game loop, physics, levels, drawing, and sound
├── tests/
│   └── collision.cjs   # Automated gameplay regression checks
└── README.md
```

Graphics are drawn using the Canvas 2D API, and sound effects use the Web Audio API. There are no runtime JavaScript packages to install. The stylesheet optionally loads fonts from Google Fonts; system fonts are used as a fallback.

## Development checks

With Node.js installed, run these commands from the repository root:

```sh
node --check game.js
node tests/collision.cjs
```

The regression checks cover collisions, lives and power-ups, level transitions, ice movement, animated spike hitboxes, obstacle jumps, and return routes. They use a simulated DOM and canvas, so also open the game in a browser to review its appearance and play feel.

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Julian Ronge.
