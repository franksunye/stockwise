# ZISO Mini Panel Tauri POC

This is an isolated Tauri v2 POC for the ZISO 2.0 Second Panel direction.

## Scope

- Mac desktop mini window.
- Always-on-top, borderless floating panel.
- Vanilla TypeScript UI.
- Mock signal runtime.
- Idle, active signal, and multiple-signal states.
- Hover expansion, click pinning, and 5-second auto collapse.
- Native floating-window controls:
  - drag from the top header
  - toggle always-on-top with `Top`
  - compact/expanded size switching with `Mini` / `Full`
  - dim mode with `Dim`
  - minimize with `-`
  - close with `x`
  - resize from the bottom-right handle
- Edge snapping and window state memory.
- Menu bar tray entry with show/hide, dock, mode, dim, critical mock, and quit actions.
- Global shortcuts:
  - `Option + Space`: show / hide
  - `Option + Z`: dock to the right edge
- Critical-signal attention behavior: show, focus, and request user attention.

This POC intentionally does not include charts, trade execution, account linking, push notifications, or the full Signal Engine.

## Local Commands

```bash
cd poc/ziso-mini-panel
npm install
npm run dev
```

The web-only development server is useful for UI iteration.

To run the native Tauri window:

```bash
cd poc/ziso-mini-panel
. "$HOME/.cargo/env"
npm run tauri dev
```

Tauri desktop development requires Rust and the platform prerequisites:

- https://www.rust-lang.org/tools/install
- https://v2.tauri.app/start/prerequisites/

## Current Environment Note

Rust was installed during POC setup and verified with:

```bash
rustc --version
cargo --version
```

If a new shell cannot find Rust, run:

```bash
. "$HOME/.cargo/env"
```
