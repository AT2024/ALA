#!/usr/bin/env node

/**
 * ALA Application Runner
 * Interactive Docker management script with all available options
 */

const { spawn, exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Colors for better UX
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Command configurations
const commands = {
    development: {
        title: '🚀 Development Mode',
        options: [
            { key: '1', name: 'Start Development Environment', cmd: 'docker-compose up -d', desc: 'Start with hot reload (default)' },
            { key: '2', name: 'Start Development + Rebuild', cmd: 'docker-compose up -d --build', desc: 'Force rebuild containers' },
            { key: '3', name: 'Development with Logs', cmd: 'docker-compose up', desc: 'Start and show logs' }
        ]
    },
    production: {
        title: '🏭 Production Mode',
        options: [
            { key: '4', name: 'Start Production Environment', cmd: 'docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d', desc: 'Optimized production build' },
            { key: '5', name: 'Start Production + Rebuild', cmd: 'docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build', desc: 'Force rebuild production' },
            { key: '6', name: 'Production with Logs', cmd: 'docker-compose -f docker-compose.yml -f docker-compose.prod.yml up', desc: 'Start production and show logs' }
        ]
    },
    management: {
        title: '🔧 Container Management',
        options: [
            { key: '7', name: 'Stop All Containers', cmd: 'docker-compose down', desc: 'Stop all running containers' },
            { key: '8', name: 'Clean Environment', cmd: 'docker-compose down -v --remove-orphans', desc: 'Stop and remove volumes' },
            { key: '9', name: 'Container Status', cmd: 'docker-compose ps', desc: 'Show container status' },
            { key: '10', name: 'System Prune', cmd: 'docker system prune -f', desc: 'Clean unused Docker resources' }
        ]
    },
    logs: {
        title: '📊 Logs & Monitoring',
        options: [
            { key: '11', name: 'All Logs (Live)', cmd: 'docker-compose logs -f', desc: 'Follow all container logs' },
            { key: '12', name: 'Backend Logs Only', cmd: 'docker-compose logs -f api', desc: 'Follow API container logs' },
            { key: '13', name: 'Frontend Logs Only', cmd: 'docker-compose logs -f frontend', desc: 'Follow frontend container logs' },
            { key: '14', name: 'Database Logs Only', cmd: 'docker-compose logs -f db', desc: 'Follow database logs' },
            { key: '15', name: 'Last 50 Lines (All)', cmd: 'docker-compose logs --tail=50', desc: 'Show recent logs' }
        ]
    },
    utilities: {
        title: '🛠️ Utilities',
        options: [
            { key: '16', name: 'Environment Setup', cmd: 'node scripts/setup.js setup', desc: 'Setup environment files' },
            { key: '17', name: 'Security Scan', cmd: 'node scripts/security-scan.js', desc: 'Run security analysis' },
            { key: '18', name: 'Debug Tool', cmd: 'node scripts/debug-unified.js', desc: 'Run diagnostic checks' },
            { key: '19', name: 'Backend Shell', cmd: 'docker-compose exec api sh', desc: 'Access backend container' },
            { key: '20', name: 'Database Shell', cmd: 'docker-compose exec db psql -U postgres -d ala_db', desc: 'Access database directly' }
        ]
    }
};

function printHeader() {
    console.clear();
    console.log(`${colors.cyan}${colors.bright}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    ALA APPLICATION RUNNER                     ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`${colors.reset}`);
    console.log(`${colors.yellow}Choose an option to manage your ALA application:${colors.reset}\n`);
}

function printMenu() {
    Object.values(commands).forEach(category => {
        console.log(`${colors.bright}${colors.magenta}${category.title}${colors.reset}`);
        console.log('─'.repeat(50));
        
        category.options.forEach(option => {
            console.log(`  ${colors.green}[${option.key}]${colors.reset} ${option.name}`);
            console.log(`      ${colors.white}${option.desc}${colors.reset}`);
        });
        console.log('');
    });
    
    console.log(`${colors.bright}${colors.red}[q/quit]${colors.reset} Exit`);
    console.log(`${colors.bright}${colors.blue}[r/refresh]${colors.reset} Refresh menu`);
    console.log('');
}

function getAllOptions() {
    const allOptions = {};
    Object.values(commands).forEach(category => {
        category.options.forEach(option => {
            allOptions[option.key] = option;
        });
    });
    return allOptions;
}

function executeCommand(cmd, description) {
    console.log(`\n${colors.cyan}Executing: ${colors.bright}${description}${colors.reset}`);
    console.log(`${colors.yellow}Command: ${cmd}${colors.reset}\n`);
    
    return new Promise((resolve) => {
        const process = spawn(cmd, [], { 
            shell: true, 
            stdio: 'inherit',
            cwd: __dirname
        });
        
        process.on('close', (code) => {
            console.log(`\n${colors.cyan}Process completed with code: ${code}${colors.reset}`);
            
            if (cmd.includes('logs -f') || cmd.includes('up') && !cmd.includes('-d')) {
                console.log(`${colors.yellow}Press Ctrl+C to stop following logs${colors.reset}`);
            }
            
            setTimeout(() => {
                console.log(`\n${colors.green}Press Enter to continue...${colors.reset}`);
                resolve();
            }, 1000);
        });
        
        process.on('error', (err) => {
            console.error(`${colors.red}Error executing command: ${err.message}${colors.reset}`);
            resolve();
        });
    });
}

function checkDockerStatus() {
    return new Promise((resolve) => {
        exec('docker --version', (error) => {
            if (error) {
                console.log(`${colors.red}❌ Docker is not installed or not running${colors.reset}`);
                console.log(`${colors.yellow}Please install Docker and try again${colors.reset}\n`);
                resolve(false);
            } else {
                exec('docker-compose --version', (error) => {
                    if (error) {
                        console.log(`${colors.red}❌ Docker Compose is not available${colors.reset}\n`);
                        resolve(false);
                    } else {
                        console.log(`${colors.green}✅ Docker environment ready${colors.reset}\n`);
                        resolve(true);
                    }
                });
            }
        });
    });
}

function showQuickStart() {
    console.log(`${colors.bright}${colors.cyan}Quick Start Guide:${colors.reset}`);
    console.log(`${colors.green}• Development:${colors.reset} Choose option [1] for hot reload (simplified setup)`);
    console.log(`${colors.green}• Production:${colors.reset} Choose option [4] for optimized production`);
    console.log(`${colors.green}• Stop:${colors.reset} Choose option [7] to stop all containers`);
    console.log(`${colors.green}• Logs:${colors.reset} Choose option [11] to monitor all logs`);
    console.log('');
}

async function main() {
    printHeader();
    
    const dockerReady = await checkDockerStatus();
    if (!dockerReady) {
        rl.close();
        process.exit(1);
    }
    
    showQuickStart();
    
    const allOptions = getAllOptions();
    
    async function promptUser() {
        printMenu();
        
        rl.question(`${colors.bright}Enter your choice: ${colors.reset}`, async (answer) => {
            const choice = answer.trim().toLowerCase();
            
            if (choice === 'q' || choice === 'quit') {
                console.log(`${colors.green}Goodbye! 👋${colors.reset}`);
                rl.close();
                return;
            }
            
            if (choice === 'r' || choice === 'refresh') {
                printHeader();
                showQuickStart();
                promptUser();
                return;
            }
            
            const option = allOptions[choice];
            if (option) {
                await executeCommand(option.cmd, option.name);
                
                rl.question('', () => {
                    printHeader();
                    promptUser();
                });
            } else {
                console.log(`${colors.red}Invalid option. Please try again.${colors.reset}\n`);
                promptUser();
            }
        });
    }
    
    promptUser();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Exiting ALA Runner...${colors.reset}`);
    rl.close();
    process.exit(0);
});

// Start the application
main().catch(console.error);