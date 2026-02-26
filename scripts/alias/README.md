# tp Launcher

This folder contains scripts to install and run the `tp` command for this project.

## What `tp` Does

`tp` launches the app in the background and shows a welcome screen in the terminal.
The app continues running even if you close the terminal window.

For full dev output (logs, errors, HMR), run `npm run start` directly.

## Files

- `tp-start.sh`: Shows the welcome screen and launches the app in the background.
- `install-tp-command.sh`: Adds the `tp` command to your `~/.zshrc` (idempotent).

## Install

From project root:

```bash
bash scripts/alias/install-tp-command.sh
source ~/.zshrc
```

Or just open a new terminal after running the install script.

## Usage

From anywhere in terminal:

```bash
tp
```

## Reinstall / Update

If script path changes, run install again:

```bash
bash scripts/alias/install-tp-command.sh
source ~/.zshrc
```

## Remove

Open `~/.zshrc` and delete the block between:

- `# >>> ok-typeless tp command >>>`
- `# <<< ok-typeless tp command <<<`
