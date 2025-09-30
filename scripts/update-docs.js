#!/usr/bin/env node

/**
 * Simple Documentation Update Script
 * Updates Azure IPs and extracts API endpoints from controllers
 * Run: node scripts/update-docs.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

// Current Azure VM IP (update this if it changes)
const CURRENT_AZURE_IP = '20.217.84.100';

/**
 * Update Azure IP address across all documentation files
 */
function updateAzureIP() {
  console.log(`${yellow}Checking Azure IP consistency...${reset}`);

  // Check deployment scripts for IP
  const deployScriptPath = path.join(__dirname, '../deployment/scripts/deploy.sh');

  if (fs.existsSync(deployScriptPath)) {
    const deployScript = fs.readFileSync(deployScriptPath, 'utf8');
    const foundIPs = deployScript.match(/\d+\.\d+\.\d+\.\d+/g) || [];

    // Filter out localhost IPs
    const azureIPs = foundIPs.filter(ip => !ip.startsWith('127.') && !ip.startsWith('0.'));

    if (azureIPs.length > 0 && azureIPs[0] !== CURRENT_AZURE_IP) {
      console.log(`${yellow}Found new Azure IP: ${azureIPs[0]}${reset}`);

      // Update all documentation files
      const filesToUpdate = [
        'CLAUDE.md',
        'docs/deployment/AZURE_DEPLOYMENT.md',
        'docs/API_REFERENCE.md',
        'docs/TROUBLESHOOTING.md'
      ];

      filesToUpdate.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf8');
          const updatedContent = content.replace(new RegExp(CURRENT_AZURE_IP, 'g'), azureIPs[0]);

          if (content !== updatedContent) {
            fs.writeFileSync(filePath, updatedContent);
            console.log(`  ✅ Updated ${file}`);
          }
        }
      });

      console.log(`${green}Azure IP updated to ${azureIPs[0]} in all docs${reset}`);
    } else {
      console.log(`${green}Azure IP is consistent (${CURRENT_AZURE_IP})${reset}`);
    }
  }
}

/**
 * Extract API endpoints from backend controllers
 */
function extractAPIEndpoints() {
  console.log(`${yellow}Extracting API endpoints...${reset}`);

  const controllersPath = path.join(__dirname, '../backend/src/controllers');

  if (!fs.existsSync(controllersPath)) {
    console.log('Controllers directory not found, skipping API extraction');
    return;
  }

  const controllers = fs.readdirSync(controllersPath).filter(f => f.endsWith('.ts'));
  let apiDoc = '# API Endpoints (Auto-Generated)\n';
  apiDoc += `Generated: ${new Date().toISOString()}\n\n`;

  let totalEndpoints = 0;

  controllers.forEach(file => {
    const filePath = path.join(controllersPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Look for route annotations and Express route definitions
    const routeComments = content.match(/@route\s+(.*)/g) || [];
    const descComments = content.match(/@desc\s+(.*)/g) || [];
    const accessComments = content.match(/@access\s+(.*)/g) || [];

    if (routeComments.length > 0) {
      const controllerName = file.replace('.ts', '').replace('Controller', '');
      apiDoc += `## ${controllerName.charAt(0).toUpperCase() + controllerName.slice(1)} Controller\n\n`;

      for (let i = 0; i < routeComments.length; i++) {
        const route = routeComments[i].replace('@route ', '');
        const desc = descComments[i] ? descComments[i].replace('@desc ', '') : 'No description';
        const access = accessComments[i] ? accessComments[i].replace('@access ', '') : 'Protected';

        apiDoc += `### ${desc}\n`;
        apiDoc += `- **Route:** \`${route}\`\n`;
        apiDoc += `- **Access:** ${access}\n\n`;

        totalEndpoints++;
      }
    }
  });

  apiDoc += `\n---\n\nTotal endpoints: ${totalEndpoints}\n`;

  // Ensure generated directory exists
  const generatedDir = path.join(__dirname, '../docs/generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  // Write the generated API documentation
  const outputPath = path.join(generatedDir, 'api-endpoints.md');
  fs.writeFileSync(outputPath, apiDoc);

  console.log(`${green}✅ Extracted ${totalEndpoints} API endpoints to docs/generated/api-endpoints.md${reset}`);
}

/**
 * Extract deployment commands from scripts
 */
function extractDeploymentCommands() {
  console.log(`${yellow}Extracting deployment commands...${reset}`);

  const scriptsPath = path.join(__dirname, '../deployment/scripts');

  if (!fs.existsSync(scriptsPath)) {
    console.log('Deployment scripts directory not found, skipping');
    return;
  }

  const scripts = fs.readdirSync(scriptsPath).filter(f => f.endsWith('.sh'));
  let deployDoc = '# Deployment Commands (Auto-Generated)\n';
  deployDoc += `Generated: ${new Date().toISOString()}\n\n`;

  scripts.forEach(file => {
    const filePath = path.join(scriptsPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract description from script comments
    const descMatch = content.match(/^#\s*Description:\s*(.*)$/m);
    const usageMatch = content.match(/^#\s*Usage:\s*(.*)$/m);

    if (descMatch || usageMatch) {
      deployDoc += `## ${file}\n`;

      if (descMatch) {
        deployDoc += `**Description:** ${descMatch[1]}\n`;
      }

      if (usageMatch) {
        deployDoc += `**Usage:** \`${usageMatch[1]}\`\n`;
      }

      deployDoc += '\n';
    }
  });

  // Ensure generated directory exists
  const generatedDir = path.join(__dirname, '../docs/generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const outputPath = path.join(generatedDir, 'deployment-commands.md');
  fs.writeFileSync(outputPath, deployDoc);

  console.log(`${green}✅ Extracted deployment commands to docs/generated/deployment-commands.md${reset}`);
}

/**
 * Main execution
 */
function main() {
  console.log('\n📚 Documentation Update Script\n');
  console.log('================================\n');

  try {
    updateAzureIP();
    console.log();

    extractAPIEndpoints();
    console.log();

    extractDeploymentCommands();
    console.log();

    console.log(`${green}✨ Documentation update complete!${reset}\n`);
    console.log('Remember to commit any documentation changes.\n');

  } catch (error) {
    console.error(`${yellow}Error updating documentation:${reset}`, error.message);
    process.exit(1);
  }
}

// Run the script
main();