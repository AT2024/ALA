#!/bin/bash
# ======================================================================
# ALA Parallel Worker Setup
# ======================================================================
# Manages Git Worktrees for parallel development with Claude Code agents.
#
# This script automates the creation of isolated development environments
# using Git Worktrees, with automatic port allocation and .env syncing.
#
# Usage:
#   ./scripts/setup-parallel-worker.sh create --branch BRANCH --name NAME
#   ./scripts/setup-parallel-worker.sh list
#   ./scripts/setup-parallel-worker.sh remove --name NAME
#   ./scripts/setup-parallel-worker.sh clean --all
#
# Examples:
#   ./scripts/setup-parallel-worker.sh create --branch feat/pdf-export --name worker-1
#   ./scripts/setup-parallel-worker.sh create --branch feat/admin-dashboard --name worker-2 --dry-run
#   ./scripts/setup-parallel-worker.sh list
#   ./scripts/setup-parallel-worker.sh remove --name worker-1
#
# Port Allocation:
#   Worker 1: Frontend 3100, Backend 5100
#   Worker 2: Frontend 3200, Backend 5200
#   Worker N: Frontend 3N00, Backend 5N00
#
# Database Isolation:
#   Each worker gets its own PostgreSQL database (ala_worker_<name>)
#   copied from the main database. This allows testing features without
#   affecting production data.
#
# Requirements:
#   - Git 2.15+ (for worktree support)
#   - Node.js 18+ (for npm install)
#   - psql (optional, for database isolation)

set -euo pipefail

# ======================================================================
# Configuration
# ======================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_DIR="$PROJECT_ROOT/.worktrees"
REGISTRY_FILE="$WORKTREE_DIR/.registry"
NEXT_NUM_FILE="$WORKTREE_DIR/.next_worker_num"

# Base ports
BASE_FRONTEND_PORT=3000
BASE_BACKEND_PORT=5000
PORT_OFFSET=100

# Colors for output (matching swarm-deploy patterns)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ======================================================================
# Helper Functions
# ======================================================================
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $*"
}

# ======================================================================
# Registry Management (Simple file-based, no jq dependency)
# ======================================================================
init_registry() {
    if [ ! -d "$WORKTREE_DIR" ]; then
        mkdir -p "$WORKTREE_DIR"
    fi
    if [ ! -f "$REGISTRY_FILE" ]; then
        touch "$REGISTRY_FILE"
    fi
    if [ ! -f "$NEXT_NUM_FILE" ]; then
        echo "1" > "$NEXT_NUM_FILE"
    fi
}

get_next_worker_number() {
    cat "$NEXT_NUM_FILE"
}

increment_worker_number() {
    local current
    current=$(cat "$NEXT_NUM_FILE")
    echo $((current + 1)) > "$NEXT_NUM_FILE"
}

# Registry format: name|branch|worker_num|frontend_port|backend_port|path
register_worker() {
    local name=$1
    local branch=$2
    local worker_num=$3
    local frontend_port=$4
    local backend_port=$5
    local path=$6

    echo "$name|$branch|$worker_num|$frontend_port|$backend_port|$path" >> "$REGISTRY_FILE"
    increment_worker_number
}

unregister_worker() {
    local name=$1
    local temp_file=$(mktemp)
    grep -v "^${name}|" "$REGISTRY_FILE" > "$temp_file" || true
    mv "$temp_file" "$REGISTRY_FILE"
}

worker_exists() {
    local name=$1
    grep -q "^${name}|" "$REGISTRY_FILE" 2>/dev/null
}

get_worker_info() {
    local name=$1
    grep "^${name}|" "$REGISTRY_FILE" 2>/dev/null
}

get_worker_path() {
    local name=$1
    local info
    info=$(get_worker_info "$name")
    echo "$info" | cut -d'|' -f6
}

# ======================================================================
# Prerequisite Checks
# ======================================================================
check_prerequisites() {
    log "Checking prerequisites..."

    # Git version (needs 2.15+ for worktrees)
    if ! command -v git &> /dev/null; then
        error "Git not found"
        exit 1
    fi

    local git_version
    git_version=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    local major_version
    major_version=$(echo "$git_version" | cut -d. -f1)
    local minor_version
    minor_version=$(echo "$git_version" | cut -d. -f2)

    if [ "$major_version" -lt 2 ] || { [ "$major_version" -eq 2 ] && [ "$minor_version" -lt 15 ]; }; then
        error "Git 2.15+ required for worktree support (found: $git_version)"
        exit 1
    fi

    # Node.js availability
    if ! command -v node &> /dev/null; then
        error "Node.js not found"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        error "npm not found"
        exit 1
    fi

    # Verify we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
        exit 1
    fi

    success "Prerequisites OK (Git $git_version, Node $(node --version))"
}

# ======================================================================
# Create Command
# ======================================================================
cmd_create() {
    local branch=""
    local name=""
    local dry_run=false
    local skip_install=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch="$2"
                shift 2
                ;;
            --name)
                name="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --skip-install)
                skip_install=true
                shift
                ;;
            *)
                error "Unknown option for create: $1"
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [ -z "$branch" ]; then
        error "Missing required argument: --branch"
        echo "Usage: $0 create --branch BRANCH --name NAME"
        exit 1
    fi

    if [ -z "$name" ]; then
        error "Missing required argument: --name"
        echo "Usage: $0 create --branch BRANCH --name NAME"
        exit 1
    fi

    # Check if worker already exists
    if worker_exists "$name"; then
        error "Worker '$name' already exists"
        echo "Use: $0 list    to see existing workers"
        echo "Use: $0 remove --name $name    to remove it first"
        exit 1
    fi

    echo ""
    echo "============================================================"
    echo "  Creating Parallel Worker: $name"
    echo "============================================================"
    echo ""

    # Calculate ports
    local worker_num
    worker_num=$(get_next_worker_number)
    local frontend_port=$((BASE_FRONTEND_PORT + worker_num * PORT_OFFSET))
    local backend_port=$((BASE_BACKEND_PORT + worker_num * PORT_OFFSET))
    local worktree_path="$WORKTREE_DIR/$name"

    info "Configuration:"
    echo "  Branch:        $branch"
    echo "  Worker Name:   $name"
    echo "  Worker Number: $worker_num"
    echo "  Frontend Port: $frontend_port"
    echo "  Backend Port:  $backend_port"
    echo "  Path:          $worktree_path"
    echo ""

    if [ "$dry_run" = true ]; then
        warning "DRY RUN - No changes will be made"
        echo ""
        echo "Would execute:"
        echo "  1. git worktree add $worktree_path $branch"
        echo "  2. Copy and patch .env files"
        echo "  3. npm install in frontend/ and backend/"
        echo "  4. Register worker in $REGISTRY_FILE"
        return 0
    fi

    # Create worktree
    log "Creating git worktree..."

    # Check if branch exists locally or remotely
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        log "  Using existing local branch: $branch"
        git worktree add "$worktree_path" "$branch"
    elif git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
        log "  Creating local branch from origin/$branch"
        git worktree add "$worktree_path" -b "$branch" "origin/$branch"
    else
        log "  Creating new branch: $branch"
        git worktree add "$worktree_path" -b "$branch"
    fi

    success "Worktree created at $worktree_path"

    # Copy and patch .env files
    log "Setting up environment files..."

    # Frontend .env - always create with relative /api URL (uses Vite proxy)
    cat > "$worktree_path/frontend/.env" << FRONTEND_ENV
# Worker Frontend Environment
# Uses relative /api URL to go through Vite's proxy (port $backend_port)
VITE_API_URL=/api
FRONTEND_ENV
    success "  Frontend .env created with VITE_API_URL=/api (uses Vite proxy)"

    # Backend .env
    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        cp "$PROJECT_ROOT/backend/.env" "$worktree_path/backend/.env"
        # Patch PORT
        if grep -q "^PORT=" "$worktree_path/backend/.env"; then
            sed -i "s|^PORT=.*|PORT=$backend_port|g" "$worktree_path/backend/.env"
        else
            echo "PORT=$backend_port" >> "$worktree_path/backend/.env"
        fi
        # Add worker frontend port to CORS_ORIGIN
        if grep -q "^CORS_ORIGIN=" "$worktree_path/backend/.env"; then
            sed -i "s|^CORS_ORIGIN=|CORS_ORIGIN=http://localhost:$frontend_port,http://127.0.0.1:$frontend_port,|g" "$worktree_path/backend/.env"
        fi
        success "  Backend .env copied and patched (PORT=$backend_port, CORS includes $frontend_port)"
    else
        warning "  No backend/.env found to copy"
    fi

    # ======================================================================
    # Database Isolation
    # ======================================================================
    # Create isolated database for this worker (copies from main database)
    local worker_db_name="ala_worker_${name}"
    log "Setting up isolated database: $worker_db_name"

    # Read database credentials from parent .env
    local db_user=""
    local db_pass=""
    local db_host="localhost"
    local db_port="5432"
    local source_db="ala_production"

    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        # Extract credentials from DATABASE_URL or individual vars
        if grep -q "^DATABASE_URL=" "$PROJECT_ROOT/backend/.env"; then
            local db_url
            db_url=$(grep "^DATABASE_URL=" "$PROJECT_ROOT/backend/.env" | cut -d'=' -f2-)
            # Parse: postgresql://user:pass@host:port/dbname
            db_user=$(echo "$db_url" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
            db_pass=$(echo "$db_url" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
            source_db=$(echo "$db_url" | sed -n 's|.*/\([^?]*\).*|\1|p')
        fi
        # Fallback to individual vars
        if [ -z "$db_user" ]; then
            db_user=$(grep "^POSTGRES_USER=" "$PROJECT_ROOT/backend/.env" | cut -d'=' -f2- || echo "ala_user")
        fi
        if [ -z "$db_pass" ]; then
            db_pass=$(grep "^POSTGRES_PASSWORD=" "$PROJECT_ROOT/backend/.env" | cut -d'=' -f2- || echo "")
        fi
    fi

    # Try to create isolated database (non-fatal if it fails)
    if command -v psql &> /dev/null && [ -n "$db_pass" ]; then
        log "  Creating database $worker_db_name from template $source_db..."

        # First check if database already exists
        if PGPASSWORD="$db_pass" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$worker_db_name"; then
            warning "  Database $worker_db_name already exists, will reuse it"
        else
            # Create database with template (copies all data and schema)
            if PGPASSWORD="$db_pass" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "CREATE DATABASE \"$worker_db_name\" WITH TEMPLATE \"$source_db\";" 2>/dev/null; then
                success "  Database $worker_db_name created with data from $source_db"
            else
                warning "  Could not create isolated database (template in use?). Trying empty database..."
                # Try creating empty database and run migrations later
                if PGPASSWORD="$db_pass" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "CREATE DATABASE \"$worker_db_name\";" 2>/dev/null; then
                    success "  Empty database $worker_db_name created"
                    warning "  NOTE: You may need to run migrations manually"
                else
                    warning "  Could not create database. Worker will share main database."
                    worker_db_name=""  # Clear to indicate shared DB
                fi
            fi
        fi

        # Patch DATABASE_URL in worker's .env if we created a database
        if [ -n "$worker_db_name" ] && [ -f "$worktree_path/backend/.env" ]; then
            sed -i "s|DATABASE_URL=postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([0-9]*\)/[^?]*|DATABASE_URL=postgresql://\1:\2@\3:\4/$worker_db_name|g" "$worktree_path/backend/.env"
            success "  DATABASE_URL patched to use $worker_db_name"
        fi
    else
        if ! command -v psql &> /dev/null; then
            warning "  psql not found - cannot create isolated database"
        else
            warning "  Database password not found - cannot create isolated database"
        fi
        warning "  Worker will share main database ($source_db)"
        worker_db_name=""  # Clear to indicate shared DB
    fi

    # Create worker metadata file
    cat > "$worktree_path/.env.worker" << EOF
# ======================================================================
# ALA Parallel Worker Environment
# ======================================================================
# Auto-generated by setup-parallel-worker.sh
# DO NOT EDIT - changes will be overwritten

WORKER_NAME=$name
WORKER_NUMBER=$worker_num
FRONTEND_PORT=$frontend_port
BACKEND_PORT=$backend_port
PARENT_REPO=$PROJECT_ROOT
DATABASE=${worker_db_name:-shared}
CREATED=$(date -Iseconds 2>/dev/null || date)
EOF
    success "  Worker metadata created (.env.worker)"

    # Patch vite.config.ts to use worker ports
    log "Patching vite.config.ts for worker ports..."
    if [ -f "$worktree_path/frontend/vite.config.ts" ]; then
        # Update frontend port (default 3000 -> worker port)
        sed -i "s|port: 3000|port: $frontend_port|g" "$worktree_path/frontend/vite.config.ts"
        # Update proxy target (default 5000 -> worker backend port)
        sed -i "s|127.0.0.1:5000|127.0.0.1:$backend_port|g" "$worktree_path/frontend/vite.config.ts"
        success "  vite.config.ts patched (frontend: $frontend_port, backend proxy: $backend_port)"
    else
        warning "  No frontend/vite.config.ts found to patch"
    fi

    # Install dependencies
    if [ "$skip_install" = false ]; then
        log "Installing dependencies (this may take a few minutes)..."

        log "  Installing frontend dependencies..."
        (cd "$worktree_path/frontend" && npm install --silent) || {
            error "Frontend npm install failed"
            exit 1
        }
        success "  Frontend dependencies installed"

        log "  Installing backend dependencies..."
        (cd "$worktree_path/backend" && npm install --silent) || {
            error "Backend npm install failed"
            exit 1
        }
        success "  Backend dependencies installed"
    else
        warning "Skipping npm install (--skip-install)"
        warning "⚠️  If you see native module errors (e.g., @rollup/rollup-win32-x64-msvc):"
        warning "   cd $worktree_path/frontend && rm -rf node_modules package-lock.json && npm install"
    fi

    # Register worker
    log "Registering worker..."
    register_worker "$name" "$branch" "$worker_num" "$frontend_port" "$backend_port" "$worktree_path"
    success "Worker registered in registry"

    # Success output
    echo ""
    echo "============================================================"
    success "Worker '$name' created successfully!"
    echo "============================================================"
    echo ""
    echo "Quick Start:"
    echo "  cd $worktree_path"
    echo ""
    echo "Start services:"
    echo "  # Terminal 1 - Backend"
    echo "  cd $worktree_path/backend && npm run dev"
    echo ""
    echo "  # Terminal 2 - Frontend"
    echo "  cd $worktree_path/frontend && npm run dev"
    echo ""
    echo "Ports:"
    echo "  Frontend: http://localhost:$frontend_port"
    echo "  Backend:  http://localhost:$backend_port"
    echo ""
    echo "Database:"
    if [ -n "$worker_db_name" ]; then
        echo "  Isolated: $worker_db_name (copy of $source_db)"
        echo "  Changes in this worker will NOT affect the main database"
    else
        echo "  Shared: $source_db (WARNING: changes affect main database)"
    fi
    echo ""
    echo "Claude Code:"
    echo "  Open a new Claude Code session in $worktree_path"
    echo "  The agent will work in isolation from other workers"
    echo ""
}

# ======================================================================
# List Command
# ======================================================================
cmd_list() {
    echo ""
    echo "============================================================"
    echo "  ALA Parallel Workers"
    echo "============================================================"
    echo ""

    if [ ! -f "$REGISTRY_FILE" ] || [ ! -s "$REGISTRY_FILE" ]; then
        info "No workers registered yet"
        echo "Create one with: $0 create --branch BRANCH --name NAME"
        return 0
    fi

    local count
    count=$(wc -l < "$REGISTRY_FILE" | tr -d ' ')

    if [ "$count" -eq 0 ]; then
        info "No workers registered"
        echo "Create one with: $0 create --branch BRANCH --name NAME"
        return 0
    fi

    # Print table header
    printf "%-15s %-25s %-10s %-10s %-8s\n" "NAME" "BRANCH" "FRONTEND" "BACKEND" "STATUS"
    printf "%-15s %-25s %-10s %-10s %-8s\n" "----" "------" "--------" "-------" "------"

    # Print each worker
    while IFS='|' read -r name branch worker_num fport bport path; do
        # Check if worktree still exists
        local status="active"
        if [ ! -d "$path" ]; then
            status="missing"
        fi
        printf "%-15s %-25s %-10s %-10s %-8s\n" "$name" "$branch" "$fport" "$bport" "$status"
    done < "$REGISTRY_FILE"

    echo ""
    echo "Total workers: $count"
    echo ""
}

# ======================================================================
# Remove Command
# ======================================================================
cmd_remove() {
    local name=""
    local force=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --name)
                name="$2"
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            *)
                error "Unknown option for remove: $1"
                exit 1
                ;;
        esac
    done

    if [ -z "$name" ]; then
        error "Missing required argument: --name"
        echo "Usage: $0 remove --name NAME"
        exit 1
    fi

    if ! worker_exists "$name"; then
        error "Worker '$name' not found"
        echo "Use: $0 list    to see existing workers"
        exit 1
    fi

    local worktree_path
    worktree_path=$(get_worker_path "$name")

    echo ""
    log "Removing worker: $name"
    log "  Path: $worktree_path"
    echo ""

    if [ "$force" = false ]; then
        if [ -t 0 ]; then
            # Interactive mode - prompt user
            read -p "Are you sure you want to remove this worker? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                info "Cancelled"
                return 0
            fi
        else
            # Non-interactive mode - require --force flag
            error "Non-interactive mode detected. Use --force to skip confirmation."
            echo "Usage: $0 remove --name $name --force"
            exit 1
        fi
    fi

    # ======================================================================
    # Database Cleanup
    # ======================================================================
    # Check if worker has an isolated database and drop it
    if [ -f "$worktree_path/.env.worker" ]; then
        local worker_db
        worker_db=$(grep "^DATABASE=" "$worktree_path/.env.worker" 2>/dev/null | cut -d'=' -f2-)

        if [ -n "$worker_db" ] && [ "$worker_db" != "shared" ]; then
            log "Cleaning up isolated database: $worker_db"

            # Read credentials from worker's .env
            local db_user=""
            local db_pass=""
            if [ -f "$worktree_path/backend/.env" ]; then
                db_user=$(grep "^POSTGRES_USER=" "$worktree_path/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "")
                db_pass=$(grep "^POSTGRES_PASSWORD=" "$worktree_path/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "")

                # Try extracting from DATABASE_URL if individual vars not found
                if [ -z "$db_user" ] || [ -z "$db_pass" ]; then
                    local db_url
                    db_url=$(grep "^DATABASE_URL=" "$worktree_path/backend/.env" 2>/dev/null | cut -d'=' -f2-)
                    if [ -n "$db_url" ]; then
                        db_user=$(echo "$db_url" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
                        db_pass=$(echo "$db_url" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
                    fi
                fi
            fi

            if command -v psql &> /dev/null && [ -n "$db_pass" ]; then
                # Terminate existing connections to the database
                PGPASSWORD="$db_pass" psql -h localhost -p 5432 -U "$db_user" -d postgres -c \
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$worker_db' AND pid <> pg_backend_pid();" 2>/dev/null || true

                # Drop the database
                if PGPASSWORD="$db_pass" psql -h localhost -p 5432 -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS \"$worker_db\";" 2>/dev/null; then
                    success "  Database $worker_db dropped"
                else
                    warning "  Could not drop database $worker_db (may need manual cleanup)"
                fi
            else
                warning "  Cannot drop database (psql not available or missing credentials)"
                warning "  Manual cleanup may be needed: DROP DATABASE \"$worker_db\";"
            fi
        fi
    fi

    # Remove worktree
    if [ -d "$worktree_path" ]; then
        log "Removing git worktree..."
        git worktree remove "$worktree_path" --force 2>/dev/null || {
            warning "Git worktree remove failed, trying manual cleanup..."
            rm -rf "$worktree_path"
        }
        success "Worktree removed"
    else
        warning "Worktree directory not found (already deleted?)"
    fi

    # Unregister
    log "Unregistering worker..."
    unregister_worker "$name"
    success "Worker unregistered"

    # Prune worktree list
    git worktree prune 2>/dev/null || true

    echo ""
    success "Worker '$name' removed successfully"
    echo ""
}

# ======================================================================
# Clean Command
# ======================================================================
cmd_clean() {
    local all=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                all=true
                shift
                ;;
            *)
                error "Unknown option for clean: $1"
                exit 1
                ;;
        esac
    done

    if [ "$all" = false ]; then
        error "Use --all to confirm cleaning all workers"
        echo "Usage: $0 clean --all"
        exit 1
    fi

    echo ""
    warning "This will remove ALL parallel workers!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Cancelled"
        return 0
    fi

    echo ""
    log "Cleaning all workers..."

    # Remove each worker's worktree
    if [ -f "$REGISTRY_FILE" ] && [ -s "$REGISTRY_FILE" ]; then
        while IFS='|' read -r name branch worker_num fport bport path; do
            log "  Removing $name..."
            if [ -d "$path" ]; then
                git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
            fi
        done < "$REGISTRY_FILE"
    fi

    # Clean up worktree directory
    if [ -d "$WORKTREE_DIR" ]; then
        rm -rf "$WORKTREE_DIR"
    fi

    # Prune git worktrees
    git worktree prune 2>/dev/null || true

    # Reinitialize registry
    init_registry

    echo ""
    success "All workers cleaned"
    echo ""
}

# ======================================================================
# Help
# ======================================================================
show_help() {
    echo ""
    echo "ALA Parallel Worker Setup"
    echo "========================="
    echo ""
    echo "Manage Git Worktrees for parallel development with Claude Code agents."
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create    Create a new parallel worker worktree"
    echo "  list      List all registered workers"
    echo "  remove    Remove a worker worktree"
    echo "  clean     Remove all workers"
    echo ""
    echo "Create Options:"
    echo "  --branch BRANCH    Branch to checkout (required)"
    echo "  --name NAME        Worker name identifier (required)"
    echo "  --dry-run          Show what would happen without making changes"
    echo "  --skip-install     Skip npm install step"
    echo ""
    echo "Remove Options:"
    echo "  --name NAME        Worker name to remove (required)"
    echo "  --force            Skip confirmation prompt"
    echo ""
    echo "Clean Options:"
    echo "  --all              Confirm removal of all workers (required)"
    echo ""
    echo "Examples:"
    echo "  $0 create --branch feat/pdf-export --name worker-1"
    echo "  $0 create --branch feat/admin --name worker-2 --dry-run"
    echo "  $0 list"
    echo "  $0 remove --name worker-1"
    echo "  $0 clean --all"
    echo ""
    echo "Port Allocation:"
    echo "  Worker 1: Frontend 3100, Backend 5100"
    echo "  Worker 2: Frontend 3200, Backend 5200"
    echo "  Worker N: Frontend 3N00, Backend 5N00"
    echo ""
}

# ======================================================================
# Main
# ======================================================================
main() {
    # Initialize registry
    init_registry

    # Parse command
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    local command=$1
    shift

    case $command in
        create)
            check_prerequisites
            cmd_create "$@"
            ;;
        list)
            cmd_list "$@"
            ;;
        remove)
            cmd_remove "$@"
            ;;
        clean)
            cmd_clean "$@"
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            echo "Use: $0 --help for usage information"
            exit 1
            ;;
    esac
}

# ======================================================================
# Execute
# ======================================================================
main "$@"
