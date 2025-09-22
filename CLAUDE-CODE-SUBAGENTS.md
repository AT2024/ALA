# Claude Code Sub-Agents for ALA Medical Application

## 🎯 Overview

Your ALA Medical Application now has 7 specialized Claude Code sub-agents that will automatically handle specific types of tasks. These agents are configured to work directly within Claude Code and will be invoked automatically based on your requests.

## 🤖 Available Sub-Agents

### 1. **Priority Integration Specialist** (`priority-integration`)
**Auto-triggered by**: Priority API, authentication, applicator validation, patient data, OData queries
```bash
# Example queries that trigger this agent:
"Fix Priority API authentication issues"
"Debug applicator validation errors"
"Optimize OData queries for patient lists"
"Check Priority API connection"
```

### 2. **Database Specialist** (`database-specialist`)
**Auto-triggered by**: Database, PostgreSQL, Sequelize, migrations, table creation, field mapping
```bash
# Example queries that trigger this agent:
"Create new database table for audit logs"
"Fix field mapping issues"
"Optimize database queries"
"Add database migration"
```

### 3. **Frontend UI Specialist** (`frontend-ui`)
**Auto-triggered by**: React components, TypeScript errors, UI styling, Tailwind CSS, state management
```bash
# Example queries that trigger this agent:
"Create new React component for treatment tracking"
"Fix TypeScript errors in components"
"Improve UI responsiveness"
"Add loading states to forms"
```

### 4. **Azure Deployment Specialist** (`deployment-azure`)
**Auto-triggered by**: Azure VM, deployment, Docker containers, production issues, SSH problems
```bash
# Example queries that trigger this agent:
"Deploy latest changes to Azure VM"
"Fix container startup issues"
"Check production health status"
"Debug SSH connection problems"
```

### 5. **Security Audit Specialist** (`security-audit`)
**Auto-triggered by**: Security vulnerabilities, authentication, JWT problems, CORS errors, compliance
```bash
# Example queries that trigger this agent:
"Audit authentication system security"
"Fix CORS configuration issues"
"Check for security vulnerabilities"
"Implement rate limiting"
```

### 6. **Testing Specialist** (`testing-specialist`)
**Auto-triggered by**: Test failures, test creation, coverage, Jest/Vitest/Playwright testing
```bash
# Example queries that trigger this agent:
"Write unit tests for Priority service"
"Fix failing E2E tests"
"Improve test coverage"
"Create integration tests"
```

### 7. **Performance Optimization Specialist** (`performance-optimization`)
**Auto-triggered by**: Slow performance, API timeouts, bundle size, memory leaks, optimization
```bash
# Example queries that trigger this agent:
"Optimize slow API endpoints"
"Reduce frontend bundle size"
"Fix memory leaks in React components"
"Implement caching strategy"
```

## 🚀 How to Use Sub-Agents

### Automatic Invocation (Recommended)
Just ask Claude Code naturally about your task. The appropriate specialist will be automatically selected:

```bash
"The Priority API is timing out when fetching patient data"
→ Automatically invokes priority-integration agent

"Need to add a new table for tracking user sessions"
→ Automatically invokes database-specialist agent

"The treatment progress component is rendering slowly"
→ Automatically invokes frontend-ui agent
```

### Manual Invocation
You can also explicitly request a specific agent:

```bash
"Use the priority-integration agent to debug the OData query issues"
"Have the deployment-azure agent check the production containers"
"Ask the security-audit agent to review the authentication flow"
```

### Parallel Agent Execution
Ask Claude Code to use multiple agents simultaneously:

```bash
"Use the database-specialist and frontend-ui agents in parallel to implement the new audit trail feature"
```

## 📊 Benefits

### 1. **Specialized Expertise**
Each agent has deep knowledge of their domain and follows best practices specific to your application.

### 2. **Automatic Routing**
Tasks are automatically routed to the right specialist without you having to think about it.

### 3. **Context Preservation**
Sub-agents work in separate contexts, keeping your main conversation clean and focused.

### 4. **Consistent Patterns**
Each agent follows established patterns and knows the critical files in your codebase.

## 🔧 Agent Capabilities

### Tool Access by Agent
- **Priority Integration**: Read, Write, Edit, MultiEdit, Bash, Grep, WebFetch
- **Database**: Read, Write, Edit, MultiEdit, Bash, Grep
- **Frontend UI**: Read, Write, Edit, MultiEdit, Bash, Grep
- **Azure Deployment**: Bash, Read, Grep, Edit
- **Security Audit**: Read, Grep, WebSearch, Edit
- **Testing**: Read, Write, Edit, MultiEdit, Bash, Grep
- **Performance**: Read, Grep, Bash, Edit

### Key Files Each Agent Knows
Each agent is pre-configured with knowledge of critical files:
- Priority agent knows `priorityService.ts`, `applicatorService.ts`
- Database agent knows model files, `database.ts`, `dbInit.ts`
- Frontend agent knows components, contexts, `Scanner.tsx`
- Azure agent knows deployment configs, VM details (20.217.84.100)
- Security agent knows auth middleware, security configs
- Testing agent knows test files and configurations
- Performance agent knows optimization targets and configs

## 📈 Usage Examples

### Typical Workflows

1. **API Issue Investigation**
   ```
   "Priority API is returning 401 errors"
   → priority-integration agent investigates auth flow
   → Checks JWT tokens, API credentials, session management
   ```

2. **New Feature Development**
   ```
   "Add treatment approval workflow"
   → database-specialist creates approval table
   → frontend-ui creates approval components
   → testing-specialist adds test coverage
   ```

3. **Production Deployment**
   ```
   "Deploy the latest changes and verify health"
   → deployment-azure handles Azure VM deployment
   → Checks container status and health endpoints
   ```

4. **Performance Investigation**
   ```
   "The app is loading slowly"
   → performance-optimization agent analyzes bottlenecks
   → Checks bundle size, API response times, database queries
   ```

## 🎛️ Configuration

### File Location
Agents are located in: `.claude/agents/`
- `priority-integration.md`
- `database-specialist.md`
- `frontend-ui.md`
- `deployment-azure.md`
- `security-audit.md`
- `testing-specialist.md`
- `performance-optimization.md`

### Customization
You can modify any agent by editing their markdown file:
- Update tool permissions in the YAML frontmatter
- Modify the description to change auto-trigger conditions
- Add domain-specific instructions in the system prompt

## 💡 Pro Tips

1. **Be Specific**: Mention specific technologies or issues to trigger the right agent
2. **Use Keywords**: Include keywords like "Priority API", "Docker", "React", "database"
3. **Trust the System**: Let Claude Code choose the agent automatically for best results
4. **Multi-Agent Tasks**: Ask for parallel execution when tasks span multiple domains
5. **Override When Needed**: Explicitly request an agent if auto-selection isn't optimal

## 🔍 Monitoring and Feedback

The sub-agents will:
- Provide clear reasoning for their selections
- Show their specialized knowledge in responses
- Follow established patterns from your CLAUDE.md file
- Work within their designated tool permissions

## 🎉 Getting Started

Start using the sub-agents immediately! Just ask Claude Code about any development task, and the appropriate specialist will automatically help you. No setup required - the agents are ready to work.

Examples to try right now:
- "Check if the Priority API is working correctly"
- "Create a new React component for user preferences"
- "Deploy the latest changes to production"
- "Run the test suite and fix any failures"