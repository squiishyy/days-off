#!/bin/zsh
cd -- "${0:A:h}"
/bin/zsh mac/install.sh "$@"
result=$?
if [[ -t 0 && " $* " != *" --prepare-only "* ]]; then
  read '?Press Return to close this window.'
fi
exit "$result"
