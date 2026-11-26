#!/bin/zsh
set -euo pipefail
print 'Remove Days off from this Mac and stop its login service?'
print 'Your browser-saved PTO will remain untouched. Export a backup before removing the app if you want a portable copy.'
read 'answer?Type REMOVE to continue: '
[[ "$answer" == REMOVE ]] || exit 0
support="$HOME/Library/Application Support/Days Off"
/bin/launchctl bootout "gui/$(id -u)/com.squiishyy.daysoff" 2>/dev/null || true
rm -f -- "$HOME/Library/LaunchAgents/com.squiishyy.daysoff.plist"
rm -rf -- "$HOME/Applications/Days Off.app"
rm -rf -- "$support"
print 'Days off removed. Browser-saved data was not deleted.'
read '?Press Return to close.'
