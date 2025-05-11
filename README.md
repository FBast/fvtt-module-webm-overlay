![](https://img.shields.io/badge/Foundry-v12-informational)

# WebM Overlay

**WebM Overlay** is a lightweight Foundry VTT module that lets Game Masters display full-screen `.webm` video overlays across all players' screens in real time. It’s perfect for adding cinematic effects, magical atmospheres, or immersive transitions during your sessions.

## Features

- Adds a new **"WebM Overlay Controls"** button in the Token controls sidebar (visible to GMs).
- Lets you browse and select `.webm` video files from a configurable directory.
- Automatically plays the selected video as a full-screen overlay for **all users**.
- Supports multiple overlays at once, with smooth **fade-in / fade-out** transitions.
- Built-in UI to **stop individual overlays** or **clear all at once**.
- Uses `mix-blend-mode: screen` to make black pixels transparent, ideal for magical or weather effects.

## Installation

1. Download and unzip the latest release into your `FoundryVTT/Data/modules` folder.
2. Enable the module via `Settings > Manage Modules`.
3. Make sure your `.webm` video files are placed in the folder configured in the module settings (default: `modules/webmoverlay/assets/overlays`).

## Usage

1. As a GM, click the **"WebM Overlay Controls"** button in the Token sidebar.
2. Select a `.webm` video from the dropdown and click the play button.
3. The overlay will appear full screen on **all clients**.
4. Use the checkboxes to stop individual overlays, or the control buttons to stop all.

> ℹ️ `.webm` files must be accessible via Foundry’s `data` directory (e.g., inside the module folder or user data path).

## Compatibility

- Compatible with Foundry VTT **v11 and v12**.
- Works with any game system.
- Purely client-side display, no system overrides or UI modifications.

## License

MIT – Free to use, modify, and redistribute.
