#!/bin/bash
# =================================================================
# ALA Application - Simple Uptime Monitoring Script
# =================================================================
# This script monitors the application health and logs status
# Can be run as a cron job for continuous monitoring

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/monitoring.log"
ALERT_LOG="$SCRIPT_DIR/alerts.log"
FRONTEND_URL="http://20.217.84.100:3000"
API_URL="http://20.217.84.100:5000/api/health"
LOCAL_FRONTEND_URL="http://localhost:3000"
LOCAL_API_URL="http://localhost:5000/api/health"

# Alert settings
ALERT_EMAIL=""  # Set this to receive email alerts
WEBHOOK_URL=""  # Set this to send webhook alerts (Slack, Discord, etc.)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log_status() {
    local level=$1
    local service=$2
    local status=$3
    local message=$4
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local color=$NC
    case $level in
        SUCCESS) color=$GREEN ;;
        WARNING) color=$YELLOW ;;
        ERROR) color=$RED ;;
    esac
    
    echo -e "${color}[$timestamp] [$level] $service: $status - $message${NC}"
    echo "[$timestamp] [$level] $service: $status - $message" >> "$LOG_FILE"
    
    if [ "$level" = "ERROR" ]; then
        echo "[$timestamp] $service FAILURE: $message" >> "$ALERT_LOG"
    fi
}

# Check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local timeout=${3:-10}
    
    local response=$(curl -s -o /dev/null -w "%{http_code},%{time_total},%{size_download}" --max-time "$timeout" "$url" 2>/dev/null || echo "000,0,0")
    IFS=',' read -r status_code response_time size <<< "$response"
    
    if [ "$status_code" = "200" ]; then
        log_status "SUCCESS" "$name" "UP" "HTTP $status_code, ${response_time}s, ${size} bytes"
        return 0
    elif [ "$status_code" = "000" ]; then
        log_status "ERROR" "$name" "DOWN" "Connection failed or timeout"
        return 1
    else
        log_status "WARNING" "$name" "DEGRADED" "HTTP $status_code, ${response_time}s"
        return 1
    fi
}

# Check Docker containers
check_containers() {
    local containers=("ala-api" "ala-frontend" "ala-db")
    local all_healthy=true
    
    for container in "${containers[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            
            if [ "$health" = "healthy" ] && [ "$status" = "running" ]; then
                log_status "SUCCESS" "$container" "HEALTHY" "Container running and healthy"
            elif [ "$status" = "running" ] && [ "$health" = "unknown" ]; then
                log_status "SUCCESS" "$container" "RUNNING" "Container running (no health check)"
            else
                log_status "ERROR" "$container" "UNHEALTHY" "Status: $status, Health: $health"
                all_healthy=false
            fi
        else
            log_status "ERROR" "$container" "NOT_FOUND" "Container not running"
            all_healthy=false
        fi
    done
    
    if $all_healthy; then
        return 0
    else
        return 1
    fi
}

# Check system resources
check_resources() {
    # Memory usage
    local mem_info=$(free | grep Mem)
    local total_mem=$(echo $mem_info | awk '{print $2}')
    local used_mem=$(echo $mem_info | awk '{print $3}')
    local mem_percent=$((used_mem * 100 / total_mem))
    
    if [ $mem_percent -gt 90 ]; then
        log_status "ERROR" "MEMORY" "HIGH" "${mem_percent}% used"
    elif [ $mem_percent -gt 80 ]; then
        log_status "WARNING" "MEMORY" "ELEVATED" "${mem_percent}% used"
    else
        log_status "SUCCESS" "MEMORY" "OK" "${mem_percent}% used"
    fi
    
    # Disk usage
    local disk_percent=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ $disk_percent -gt 90 ]; then
        log_status "ERROR" "DISK" "HIGH" "${disk_percent}% used"
    elif [ $disk_percent -gt 80 ]; then
        log_status "WARNING" "DISK" "ELEVATED" "${disk_percent}% used"
    else
        log_status "SUCCESS" "DISK" "OK" "${disk_percent}% used"
    fi
}

# Send alert (if configured)
send_alert() {
    local message=$1
    
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "ALA Application Alert" "$ALERT_EMAIL"
    fi
    
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 ALA Alert: $message\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Main monitoring function
main() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "\n${GREEN}=== ALA Application Health Check - $timestamp ===${NC}"
    
    local overall_status="HEALTHY"
    local issues=()
    
    # Check external endpoints
    if ! check_http "Frontend (External)" "$FRONTEND_URL"; then
        overall_status="DEGRADED"
        issues+=("Frontend not accessible externally")
    fi
    
    if ! check_http "API (External)" "$API_URL"; then
        overall_status="DEGRADED"
        issues+=("API not accessible externally")
    fi
    
    # Check local endpoints (if running on the server)
    if [ -n "${SSH_CLIENT:-}" ] || [ "$(hostname)" = "ALAapp" ]; then
        check_http "Frontend (Local)" "$LOCAL_FRONTEND_URL" 5 || true
        check_http "API (Local)" "$LOCAL_API_URL" 5 || true
        
        # Check containers
        if ! check_containers; then
            overall_status="CRITICAL"
            issues+=("Container health issues detected")
        fi
        
        # Check system resources
        check_resources
    fi
    
    # Summary
    echo -e "\n${GREEN}=== Summary ===${NC}"
    
    case $overall_status in
        HEALTHY)
            echo -e "${GREEN}✅ Overall Status: HEALTHY${NC}"
            log_status "SUCCESS" "SYSTEM" "HEALTHY" "All services operational"
            ;;
        DEGRADED)
            echo -e "${YELLOW}⚠️  Overall Status: DEGRADED${NC}"
            log_status "WARNING" "SYSTEM" "DEGRADED" "${#issues[@]} issues: ${issues[*]}"
            ;;
        CRITICAL)
            echo -e "${RED}🚨 Overall Status: CRITICAL${NC}"
            log_status "ERROR" "SYSTEM" "CRITICAL" "${#issues[@]} critical issues: ${issues[*]}"
            send_alert "System status: CRITICAL. Issues: ${issues[*]}"
            ;;
    esac
    
    if [ ${#issues[@]} -gt 0 ]; then
        echo "Issues detected:"
        for issue in "${issues[@]}"; do
            echo -e "${RED}  • $issue${NC}"
        done
    fi
    
    echo ""
}

# Show usage
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Simple uptime monitoring for ALA application"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --quiet        Suppress output (for cron jobs)"
    echo "  --alerts-only  Only show critical alerts"
    echo ""
    echo "To run every 5 minutes, add to crontab:"
    echo "*/5 * * * * $0 --quiet"
    echo ""
    exit 0
fi

# Handle quiet mode
if [ "${1:-}" = "--quiet" ]; then
    exec 1>/dev/null
fi

# Handle alerts-only mode
if [ "${1:-}" = "--alerts-only" ]; then
    main 2>&1 | grep -E "(ERROR|CRITICAL|Alert)" || true
    exit 0
fi

# Run main function
main "$@"