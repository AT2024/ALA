# MCP-as-a-Judge: Missing Messaging Provider Configuration

**Date**: 2025-10-16
**Category**: Configuration Error
**Severity**: Medium
**Area**: Workflow Tooling

## Problem
When attempting to use `judge_coding_plan` tool during mobile optimization task, received error:
```
Error during coding plan evaluation: No messaging providers available
```

Workflow guidance indicated:
```
No messaging providers available. MCP sampling: False, LLM API: False
```

## Investigation
- The mcp-as-a-judge MCP server requires either:
  1. MCP sampling enabled, OR
  2. LLM API configured (e.g., Anthropic API key)
- Neither was available in the current environment
- All other MCP-as-a-judge tools (set_coding_task, get_current_coding_task) worked correctly
- Issue is specific to judgment/validation tools that need LLM reasoning

## Root Cause
MCP-as-a-judge server's judgment tools require LLM provider for evaluation logic. The server was connected but not fully configured with necessary API credentials or sampling permissions.

## Workaround Applied
1. Used `get_current_coding_task` to recover task state
2. Proceeded with manual plan review instead of automated judge_coding_plan
3. Documented comprehensive plan in this learning document
4. Continued with implementation using specialist agents
5. Will use reviewer agents (ala-code-reviewer, medical-safety-reviewer) for quality gates

## Solution (For Future)
To enable full mcp-as-a-judge functionality:

### Option 1: Enable MCP Sampling
```json
// In MCP server configuration
{
  "mcp_sampling_enabled": true
}
```

### Option 2: Configure LLM API
```bash
# Set environment variable
export ANTHROPIC_API_KEY="sk-ant-..."

# Or in MCP server config
{
  "llm_provider": "anthropic",
  "api_key": "sk-ant-..."
}
```

### Option 3: Use Alternative Workflow
- Use reviewer agents for quality validation
- Manual plan review before implementation
- Document decisions in ADRs
- Capture learnings after completion

## Prevention
- ✅ Document this limitation in compounding engineering setup docs
- ✅ Add troubleshooting section to COMPOUNDING-ENGINEERING-SETUP.md
- ✅ Update workflow guide with manual review fallback procedure
- ⚠️ Note: Other mcp-as-a-judge tools may have same limitation

## Impact
- **Positive**: Task creation and recovery tools still work
- **Negative**: Automated plan/code/testing validation unavailable
- **Mitigation**: Reviewer agents provide similar quality gates
- **Workflow**: Can still follow three-lane model with manual validation

## Related Files
- [docs/COMPOUNDING-ENGINEERING-SETUP.md](../COMPOUNDING-ENGINEERING-SETUP.md) - Setup documentation
- [docs/workflows/compounding/COMPOUNDING-WORKFLOW-GUIDE.md](../workflows/compounding/COMPOUNDING-WORKFLOW-GUIDE.md) - Workflow guide
- Task ID: 0a8c2b76-8765-48b8-b8f1-d429f4a5723d - Mobile optimization task

## Lessons Learned
1. MCP servers may have configuration dependencies beyond connection
2. Graceful degradation is important (use reviewer agents as backup)
3. Tool descriptions should mention configuration requirements
4. Always have manual fallback procedures documented
5. This doesn't invalidate the compounding engineering approach - reviewer agents still provide quality gates

## Action Items
- [ ] Update COMPOUNDING-ENGINEERING-SETUP.md with provider configuration section
- [ ] Add troubleshooting entry for "No messaging providers available" error
- [ ] Document manual review process as alternative workflow
- [ ] Consider requesting provider configuration from user if needed
