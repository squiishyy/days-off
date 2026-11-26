# Install Days off on a Mac

## For the person receiving the app

1. Unzip **Days-Off-Mac.zip**.
2. Double-click **Install or Update Days Off.command** inside the Days Off folder.
3. When it finishes, **Days Off** is in your personal Applications folder (`~/Applications`). Open it whenever you want the calendar. The installer opens it once for you.
4. Enter your balance and accrual dates. A short illustrated guide then shows how to use the calendar. Skip it anytime, or replay it with **How to use**.

No GitHub login, Homebrew, administrator password, or existing Node installation is required. The first installation needs internet access to download a private copy of the official Node.js runtime. The planner then works offline. Supports Apple silicon and Intel Macs running macOS 13.5 or newer.

If macOS asks you to approve opening the downloaded installer, review and approve it using macOS's normal security prompt. The installer does not change Gatekeeper or other security settings.

## After restarting the computer

A user LaunchAgent starts the local server automatically after you log in. No Terminal window needs to remain open. Open **Days Off** from your personal Applications folder; you can add it to the Dock. The browser is not opened automatically at every login.

The address is always **http://localhost:4173**. The launcher prefers Google Chrome when installed and otherwise uses your default browser. Keep using the same browser **and profile** to see the same plan.

PTO settings, labeled/color-coded time off, other events, and company holidays are saved in that browser's localStorage. They survive closing the tab, quitting the browser, restarting the local server, and restarting the Mac. Installing updates or reinstalling does not clear them.

Clearing browser site data or using an incognito/private session is different: those can remove saved data. Export a backup from the planner if you want a portable copy, before clearing browser data, or before changing computers or browser profiles. Import restores that copy. Nothing is synced to GitHub. Old saved plans and JSON backups remain compatible with version 1.1; labels, colors, and other events are optional additions to the existing storage format.

## Updates

Send the newer **Days-Off-Mac.zip**, unzip it, and double-click **Install or Update Days Off.command**. Use that same file for both installation and updates. No uninstall, GitHub account, Terminal commands, or data migration is needed.

The updater checks the new code, keeps a previous-code copy for rollback, replaces the installed app, and restarts its login service at **the same localhost address and port**. It never clears browser storage. Updates do not open a different browser or profile.

For this first update from the original version, return to the existing calendar tab and press **Command-R** once if needed. Confirm **v1.1.0** at the bottom. Version 1.1 and later can detect later updates and refresh an idle calendar in the same tab; an unsaved editor is protected until you finish editing or choose Reload app.

macOS may ask you to approve a newly downloaded installer through Privacy & Security > Open Anyway. This app remains unsigned; the updater does not disable Apple security protections. The installer does not silently download future app updates.

## If installation says the port is already in use

If you used the old **Start Days Off.command** launcher, stop its server with Control-C in that Terminal window and rerun the installer. The installer will not kill an unrelated process or move to another port, since a different port would have separate browser storage.

## What is installed

- `~/Applications/Days Off.app`: the app shortcut.
- `~/Library/Application Support/Days Off/app/`: local website and server.
- `~/Library/Application Support/Days Off/runtime/`: private Node.js runtime (does not replace a system installation).
- `~/Library/LaunchAgents/com.squiishyy.daysoff.plist`: starts the server at login and restarts it if it exits.
- `~/Library/Application Support/Days Off/logs/`: startup and server logs.

The server listens only on this computer's loopback interface. If login startup is disabled in System Settings > General > Login Items & Extensions, enable it again to restore automatic startup.

## Uninstall

Double-click `~/Library/Application Support/Days Off/Uninstall Days Off.command`. It asks you to type REMOVE, stops the login service, and removes the installed files. Browser-saved PTO is left untouched. Export first if you want a backup.

## Installer verification

The shell installer pins Node.js 24.22.3 and checks the downloaded archive against the SHA-256 checksums in that release's official SHASUMS256.txt. No package installation scripts run.

Developers can prepare a sandbox installation without enabling a login item or opening a browser:

```sh
./'Install or Update Days Off.command' --prepare-only --test-root /absolute/path/to/test-folder
```

This writes all installation outputs beneath the test folder and validates the generated property lists. It still downloads the official runtime if it is not cached in that test folder. A temporary LaunchAgent was also tested: it started the installed server and restarted it after termination, and was then removed. Saved PTO and holidays were verified after a server restart and tab close/reopen. A full Mac reboot was not performed; login behavior should be checked on the recipient Mac.

References: [Apple launchd documentation](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), [browser storage persistence](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), and [official Node.js 24.22.3 release](https://nodejs.org/en/blog/release/v24.22.3).
