#!/usr/bin/env bash
# git-setup.sh — source this once at the start of any Claude session that uses git
#
# Problem: .git/ lives on a Windows NTFS mount. The Linux VM can create and
# rename files there but cannot DELETE them. Git leaves index.lock behind after
# every write operation; the next git write fails with "Another git process
# seems to be running."
#
# Fix: wrap git to rename (not delete) index.lock out of .git/ before and
# after every call. mv to /tmp works because it's a cross-device rename that
# the kernel handles as copy+delete-source on local tmpfs.

_GIT_DIR="/sessions/wizardly-exciting-mendel/mnt/bmore-demo/.git"

_clear_git_lock() {
  local lock="$_GIT_DIR/index.lock"
  if [ -f "$lock" ]; then
    mv "$lock" "/tmp/git-index.lock.stale" 2>/dev/null || true
  fi
}

git() {
  _clear_git_lock            # remove any stale lock before we start
  command git "$@"           # run the real git
  local rc=$?
  _clear_git_lock            # clean up the lock this call may have left
  return $rc
}

export -f git _clear_git_lock
echo "✓ git wrapper active — index.lock will be auto-cleaned via mv"
