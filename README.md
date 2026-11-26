# Days off

A small, local PTO planning calendar. No account, cloud backend, or npm dependencies.

## Install on a Mac

Double-click **Install Days Off.command**. It downloads a private Node.js runtime, installs a Days Off app shortcut, and starts a local server that comes back at login after a restart. You do not need GitHub access or an administrator password. See [Mac installation instructions](MAC-INSTALL.md) for details, updates, and uninstalling.

## Run without installing

On this Mac, double-click **Start Days Off.command**. It starts the server and opens your default browser. Keep the Terminal window open while using the planner.

Alternatively, install Node.js 20 or newer, then run in this folder:

```sh
npm start
```

Open http://localhost:4173 in Chrome. Keep using this address: browser storage is tied to the address and port. Stop the server with Control-C. The planner works offline once the files are on your computer.

## First-time guide

After setup, a short illustrated walkthrough explains calendar navigation, drag selection, balance colors, company holidays, editing/removing PTO, and saved data. It appears once per browser profile. Complete it, skip it, or press Escape to dismiss it. **How to use** in the header replays it anytime. The guide uses examples only and never changes your plan. Starting over does not reset the guide preference.

## Plan time off

- Setup: balance and effective date, annual PTO in 8-hour days, and next biweekly accrual date. Annual PTO / 26 estimates each deposit; enter the exact payroll amount when available.
- Switch between Year and Month; click a month name for its detailed calendar.
- Click a date or drag across dates to open the PTO editor. Adjust the range and hours before saving. Weekends and company holidays consume no PTO. On touch devices, tap a day and use the date fields for a range.
- Right-click a date for holiday actions, or use the holiday button in the single-day editor. Keyboard users can press Shift-F10 on a date. Marking a holiday removes PTO already entered for that day.
- Colors identify PTO, insufficient balance, and company holidays. Accrual dates have a small dot. Select a day to inspect projected availability.
- Red PTO days are saved as hypothetical plans, even when infeasible. Their costs carry forward to later days.
- Settings updates the calculation without deleting entries. Start over asks for confirmation, clears PTO and holidays, and opens setup with the previous settings prefilled.
- Export/Import moves or backs up the plan as JSON. Import asks before replacing a current plan.

## Calculation rules

The starting balance is the balance **before any events on the effective date**. Enter the next accrual date on or after that date; deposits then occur every 14 calendar days, including in years with 27 such dates. The annual total is used to estimate a fixed deposit using 26 deposits; it is not a yearly cap. Matching the exact payroll deposit is the most accurate option.

Accrual is available before PTO on the same date. There are no caps, expiration, rollover limits, or annual resets. Dates are handled as calendar dates without timezone conversion. Calculations use microhours, then display rounded to two decimals. PTO is assigned per date; saving an overlapping range replaces the selected days' hours rather than double-counting them.

Data stays in this browser's localStorage. Clearing browser data removes it; use Export for backups. Code in GitHub does not contain entered PTO data. A normal browser refresh, browser quit, server restart, or Mac restart retains the plan in the same browser profile at the same address. Private browsing storage lasts only for the private session.

## Checks

```sh
npm test
```

The calculation tests cover chronological shortfalls, biweekly deposits, same-day accrual, partial days, holidays, overlap, year boundaries, and import validation.
