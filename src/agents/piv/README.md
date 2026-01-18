# PIV Loop Implementation

**Plan → Implement → Validate** loop adapted from Cole Medin's methodology for local execution.

## Overview

This implementation replaces SCAR (remote GitHub webhook-based agent) with local subagents that can be spawned directly by the supervisor-service.

## Architecture

```
User → MCP Tool (mcp__meta__start_piv_loop)
         ↓
    PIVOrchestrator
         ↓
    ┌────────────┬────────────┬────────────┐
    │            │            │            │
 PrimePhase  PlanPhase  ExecutePhase
    │            │            │
    ↓            ↓            ↓
 Context     Plan Doc     Implementation
```

## Three Phases

### 1. Prime Phase (Research)

**Purpose:** Analyze codebase and understand project context

**Inputs:**
- Project name and path
- Epic definition

**Process:**
1. Analyze project structure (package.json, tsconfig.json)
2. Detect tech stack (TypeScript, React, PostgreSQL, etc.)
3. Find naming conventions (camelCase, kebab-case, etc.)
4. Analyze dependencies
5. Search local RAG for similar patterns
6. Identify integration points

**Output:**
- Context document (`.agents/plans/context-{epic-id}.md`)
- Tech stack
- Code conventions
- RAG insights
- Integration points

### 2. Plan Phase (Design)

**Purpose:** Create detailed, prescriptive implementation plan

**Inputs:**
- Context from Prime phase
- Epic definition
- Prime result

**Process:**
1. Read context document
2. Design solution approach
3. Break down into phases
4. Create prescriptive tasks (file-by-file)
5. Define validation commands

**Output:**
- Implementation plan (`.agents/plans/plan-{epic-id}.md`)
- Phases with tasks
- Validation commands
- Estimated duration

### 3. Execute Phase (Implementation)

**Purpose:** Execute plan and validate each phase

**Inputs:**
- Plan from Plan phase
- Epic ID
- Project name

**Process:**
1. Create feature branch
2. For each phase:
   - Execute all tasks (create/update/delete files)
   - Run validation command
   - Retry on failure (once)
3. Commit changes
4. Create pull request

**Output:**
- Success/failure status
- Branch name
- PR number and URL
- Files changed
- Validation results

## Files Created

```
src/agents/piv/
├── types.ts              # TypeScript type definitions
├── PrimePhase.ts         # Phase 1: Research and analysis
├── PlanPhase.ts          # Phase 2: Design and planning
├── ExecutePhase.ts       # Phase 3: Implementation and validation
├── PIVOrchestrator.ts    # Main orchestrator
├── index.ts              # Module exports
└── README.md             # This file
```

## MCP Tools Added

### `mcp__meta__start_piv_loop`

Start the PIV loop for an epic.

**Parameters:**
- `projectName` (string, required): Project name
- `projectPath` (string, required): Absolute path to project workspace
- `epicId` (string, required): Epic ID (e.g., "epic-010")
- `epicTitle` (string, required): Epic title
- `epicDescription` (string, optional): Epic description
- `acceptanceCriteria` (array, optional): Acceptance criteria
- `tasks` (array, required): List of tasks to implement
- `skipPrime` (boolean, optional): Skip Prime if context exists

**Returns:**
- `success` (boolean): True if completed successfully
- `currentPhase` (string): Current phase or 'complete'/'failed'
- `primeResult`: Summary of Prime phase
- `planResult`: Summary of Plan phase
- `executeResult`: Summary of Execute phase with PR info
- `error` (string, optional): Error message if failed

### `mcp__meta__piv_status`

Get status of PIV loop execution (stub for now).

**Parameters:**
- `epicId` (string, required): Epic ID to check

**Returns:**
- Status information (not yet implemented)

## Usage Example

```typescript
import { PIVOrchestrator } from './agents/piv';

// Define project and epic
const project = {
  name: 'supervisor-service',
  path: '/home/samuel/sv/supervisor-service',
};

const epic = {
  id: 'epic-010',
  title: 'PIV Loop Implementation',
  description: 'Implement Plan → Implement → Validate loop',
  acceptanceCriteria: [
    'PrimePhase implemented',
    'PlanPhase implemented',
    'ExecutePhase implemented',
    'MCP tools added',
  ],
  tasks: [
    'Create PrimePhase class',
    'Create PlanPhase class',
    'Create ExecutePhase class',
    'Create PIVOrchestrator',
    'Add MCP tools',
  ],
};

// Run PIV loop
const orchestrator = new PIVOrchestrator(project.path);
const state = await orchestrator.run(project, epic);

console.log(`Phase: ${state.currentPhase}`);
console.log(`Success: ${state.currentPhase === 'complete'}`);
if (state.executeResult) {
  console.log(`PR: ${state.executeResult.prUrl}`);
}
```

## Differences from Cole Medin's PIV Loop

### What We Kept

✅ Plan → Implement → Validate methodology
✅ Deep codebase analysis
✅ Pattern recognition
✅ Prescriptive task instructions
✅ Validation commands

### What We Changed

❌ Remote agent via webhooks → Local subagents
❌ GitHub issues for communication → Direct MCP tool calls
❌ Archon task management → GitHub issues (audit only)
❌ Worktrees → Feature branches
❌ Slash commands → TypeScript methods

## Implementation Status

### ✅ Completed

- [x] Type definitions (`types.ts`)
- [x] PrimePhase implementation
- [x] PlanPhase implementation
- [x] ExecutePhase implementation
- [x] PIVOrchestrator
- [x] MCP tool definitions
- [x] MCP tool handlers

### 🚧 TODO (Future Enhancements)

- [ ] Integrate actual RAG search in PrimePhase
- [ ] Use LLM to generate actual code in ExecutePhase
- [ ] Integrate GitHub CLI for real PR creation
- [ ] Add PIV state persistence (database)
- [ ] Add progress monitoring/callbacks
- [ ] Implement `mcp__meta__piv_status` properly
- [ ] Add retry logic with exponential backoff
- [ ] Add support for parallel phase execution
- [ ] Create validation report generator
- [ ] Add cost tracking (model usage)

## Notes

**CRITICAL:** This replaces SCAR. The PIV loop runs locally using subagents spawned by supervisor-service, not remote webhooks.

**Model Selection:** In production, use:
- Sonnet for Prime and Plan phases (complex analysis)
- Haiku for Execute phase (following prescriptive instructions)

**Validation:** Each phase runs validation commands. If validation fails, it retries once. On second failure, execution stops.

**GitHub Integration:** Currently stubbed. To enable real PRs, uncomment GitHub CLI code in `ExecutePhase.createPullRequest()`.

## References

- Epic definition: `/home/samuel/sv/supervisor-service/EPIC-BREAKDOWN-supervisor-service.md` (Epic 10)
- Adaptation guide: `/home/samuel/sv/docs/piv-loop-adaptation-guide.md`
- Cole Medin's PIV loop: Inspiration for methodology
