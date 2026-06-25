#!/usr/bin/env bash
#
# docker-cleanup.sh — threshold-gated Docker disk reclaim for the ALA production VM.
#
# Runs daily from cron (see install-cleanup-cron). Yesterday's outage was a full disk
# wedging Docker: swarm-deploy builds a new timestamped image every deploy and only
# dangling images get pruned, so old tagged images + build cache grow forever between
# deploys. This reclaims them on a timer, but ONLY when the disk is actually filling.
#
# ponytail: alerting is NOT done here — a full disk wedges Docker, so any in-VM/Docker
# alert would hang exactly when needed. Azure Monitor (control plane) owns the alert;
# this script just reclaims space, logs, and exits non-zero when it can't keep up.
#
# Knobs (env overridable):
#   DISK_THRESHOLD     prune only when / usage is at/above this %   (default 70)
#   IMAGE_RETAIN_HOURS keep unused images newer than this many hrs  (default 72 ≈ 3 deploys)
#
# Manual run:        deployment/docker-cleanup.sh
# Force a prune now: DISK_THRESHOLD=0 deployment/docker-cleanup.sh
# Self-test:         deployment/docker-cleanup.sh --self-test

set -uo pipefail

THRESHOLD="${DISK_THRESHOLD:-70}"
RETAIN="${IMAGE_RETAIN_HOURS:-72}"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) $*"; }

# Root-filesystem usage as a bare integer percent (GNU coreutils df on Ubuntu).
disk_usage() { df --output=pcent / | tail -1 | tr -dc '0-9'; }

# --self-test: prove the parse + threshold branch without touching Docker.
if [[ "${1:-}" == "--self-test" ]]; then
  u="$(disk_usage)"
  [[ "$u" =~ ^[0-9]+$ ]] || { echo "FAIL: disk_usage returned non-numeric: '$u'"; exit 1; }
  (( u >= 0 && u <= 100 )) || { echo "FAIL: disk_usage out of range: $u"; exit 1; }
  echo "OK: disk_usage=$u%, threshold=$THRESHOLD%, retain=${RETAIN}h"
  exit 0
fi

before="$(disk_usage)"
log "disk ${before}% used (threshold ${THRESHOLD}%)"

if (( before < THRESHOLD )); then
  log "below threshold — nothing to do"
  exit 0
fi

log "above threshold — pruning unused images older than ${RETAIN}h + build cache"
# `timeout` so a partially-wedged Docker can't hang the cron slot.
# NEVER --volumes: the production Postgres data lives in a Docker volume.  ponytail: keep volumes.
timeout 300 docker image prune -af --filter "until=${RETAIN}h" || log "WARNING: image prune did not finish cleanly"
timeout 300 docker builder prune -f --keep-storage 2GB        || log "WARNING: builder prune did not finish cleanly"

after="$(disk_usage)"
log "disk ${before}% -> ${after}%"

if (( after >= THRESHOLD )); then
  log "WARNING: still ${after}% after cleanup — Azure Monitor should alert; manual intervention may be needed"
  exit 1
fi

log "done"
exit 0
