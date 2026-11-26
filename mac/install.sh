#!/bin/zsh
set -euo pipefail
source_dir="${0:A:h:h}"
prepare_only=false
test_root=''
while (( $# )); do
  case "$1" in
    --prepare-only) prepare_only=true; shift ;;
    --test-root) test_root="$2"; shift 2 ;;
    *) print -u2 "Unknown option: $1"; exit 1 ;;
  esac
done
[[ "$(uname -s)" == Darwin ]] || { print -u2 'This installer is for macOS.'; exit 1; }
mac_version=$(/usr/bin/sw_vers -productVersion)
autoload -Uz is-at-least
is-at-least 13.5 "$mac_version" || { print -u2 'Days off requires macOS 13.5 or newer.'; exit 1; }
if $prepare_only; then
  [[ -n "$test_root" && "$test_root" == /* ]] || { print -u2 '--prepare-only requires an absolute --test-root.'; exit 1; }
  install_root="$test_root/Library/Application Support/Days Off"
else
  [[ -z "$test_root" ]] || { print -u2 '--test-root is only allowed with --prepare-only.'; exit 1; }
  install_root="$HOME/Library/Application Support/Days Off"
fi
arch=$(uname -m)
if [[ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" == 1 ]]; then arch=arm64; fi
case "$arch" in
  arm64) node_arch=arm64; expected_sha=ff6e17d4874b76d272212b908cc020d6e815fba5a6c7eaaa06add725840307fd ;;
  x86_64) node_arch=x64; expected_sha=977614af0504c81045e7fd85596dbca0e5f951b96681516dadafedcca8c447f7 ;;
  *) print -u2 "Unsupported Mac architecture: $arch"; exit 1 ;;
esac
node_version=v24.22.3
node_dir="$install_root/runtime/$node_version-$node_arch"
print 'Installing Days off for this Mac user (no administrator password needed).'
mkdir -p "$install_root/runtime"
if [[ ! -x "$node_dir/bin/node" ]]; then
  stage_dir=$(mktemp -d "$install_root/runtime/.download.XXXXXX")
  trap 'rm -rf -- "$stage_dir"' EXIT
  archive="node-$node_version-darwin-$node_arch.tar.gz"
  print "Downloading the official Node.js runtime ($node_version, $node_arch)..."
  /usr/bin/curl --fail --location --show-error --retry 2 --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$node_version/$archive" -o "$stage_dir/$archive"
  actual_sha=$(/usr/bin/shasum -a 256 "$stage_dir/$archive" | /usr/bin/awk '{print $1}')
  [[ "$actual_sha" == "$expected_sha" ]] || { print -u2 'The runtime checksum did not match. Installation stopped.'; exit 1; }
  /usr/bin/tar -xzf "$stage_dir/$archive" -C "$stage_dir"
  mv -- "$stage_dir/node-$node_version-darwin-$node_arch" "$node_dir"
  rm -rf -- "$stage_dir"
  trap - EXIT
fi
"$node_dir/bin/node" --version
args=(--source "$source_dir" --runtime "$node_dir/bin/node")
if $prepare_only; then args+=(--prepare-only --test-root "$test_root"); fi
"$node_dir/bin/node" "$source_dir/mac/install.mjs" "${args[@]}"
