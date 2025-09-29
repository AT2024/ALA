#!/bin/bash

# =================================================================
# ALA Azure VM Auto-Recovery Health Monitor
# =================================================================
# Continuous monitoring with automatic recovery
# Usage: nohup ~/ala-improved/deployment/scripts/monitor-auto.sh > monitor-auto.log 2>&1 &

# Configuration
PROJECT_DIR="$HOME/ala-improved"
AZURE_DIR="$PROJECT_DIR/deployment/azure"
RECOVERY_SCRIPT="$AZURE_DIR/recover.sh"
CHECK_INTERVAL=30  # seconds
MAX_FAILURES=3

# Counters
declare -A failure_count

# Function to check service health
check_service() {
    local service=$1
    local url=$2

    if timeout 10 curl -f -s "$url" > /dev/null 2>&1; then
        failure_count[$service]=0
        return 0
    else
        failure_count[$service]=$((failure_count[$service] + 1))
        return 1
    fi
}

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "ALA Auto-Recovery Monitor Started (PID: $$)"

while true; do
    # Check frontend
    if ! check_service "frontend" "http://localhost:3000"; then
        log "WARNING: Frontend health check failed (${failure_count[frontend]}/$MAX_FAILURES)"
        if [ ${failure_count[frontend]} -ge $MAX_FAILURES ]; then
            log "CRITICAL: Frontend failure threshold reached, triggering recovery"
            bash "$RECOVERY_SCRIPT"
            failure_count[frontend]=0
        fi
    fi

    # Check API
    if ! check_service "api" "http://localhost:5000/api/health"; then
        log "WARNING: API health check failed (${failure_count[api]}/$MAX_FAILURES)"
        if [ ${failure_count[api]} -ge $MAX_FAILURES ]; then
            log "CRITICAL: API failure threshold reached, triggering recovery"
            bash "$RECOVERY_SCRIPT"
            failure_count[api]=0
        fi
    fi

    # Check database connectivity
    if ! docker exec ala-db-azure pg_isready -U ala_user -d ala_production > /dev/null 2>&1; then
        failure_count[database]=$((failure_count[database] + 1))
        log "WARNING: Database health check failed (${failure_count[database]}/$MAX_FAILURES)"
        if [ ${failure_count[database]} -ge $MAX_FAILURES ]; then
            log "CRITICAL: Database failure threshold reached, triggering recovery"
            bash "$RECOVERY_SCRIPT"
            failure_count[database]=0
        fi
    else
        failure_count[database]=0
    fi

    # Log healthy status every 10 minutes
    if [ $(($(date +%s) % 600)) -eq 0 ]; then
        log "All services healthy"
    fi

    sleep $CHECK_INTERVAL
done