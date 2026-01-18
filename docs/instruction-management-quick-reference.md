# Instruction Management - Quick Reference

**Epic 008 Implementation**
**Date:** 2026-01-18

---

## Quick Start

### Update All Supervisors

**From Meta-Supervisor:**
```typescript
// Update all supervisors (meta + all projects)
await mcp__meta__propagate_instructions({});

// Update specific projects only
await mcp__meta__propagate_instructions({
  projects: ['consilio', 'odin']
});
```

**Result:** All CLAUDE.md files regenerated from core instruction layers.

### Optimize Project Instructions

**From Meta-Supervisor:**
```typescript
await mcp__meta__adapt_project({
  projectName: 'consilio',
  projectPath: '/home/samuel/supervisor/consilio'
});
```

**Result:** Tech stack analyzed, project-specific instructions generated.

---

## File Locations

### Core Instructions (Shared)
```
/home/samuel/sv/supervisor-service/.supervisor-core/
├── core-behaviors.md      # Autonomous supervision, context management
├── tool-usage.md          # Tool patterns, subagent usage
└── bmad-methodology.md    # Epic creation, ADRs, validation
```

**Edit these to update ALL supervisors.**

### Meta-Specific Instructions
```
/home/samuel/sv/supervisor-service/.supervisor-meta/
└── meta-specific.md       # Meta-supervisor role and tools
```

**Edit this to update ONLY meta-supervisor.**

### Project-Specific Instructions
```
/home/samuel/supervisor/{project}/.claude-specific/
└── {project}-custom.md    # Project-specific behaviors
```

**Edit these for individual project customizations.**
**Never auto-overwritten.**

---

## Common Tasks

### 1. Change Shared Behavior

**Example:** Make supervisors report minor errors

**Steps:**
1. Edit `/home/samuel/sv/supervisor-service/.supervisor-core/core-behaviors.md`
2. Add new section or modify existing:
   ```markdown
   ### Error Reporting
   - Report minor errors proactively
   - Include context and suggested fixes
   ```
3. Run: `mcp__meta__propagate_instructions({})`
4. Done! All supervisors updated.

### 2. Add New Core Instruction File

**Example:** Add `scar-integration.md` for SCAR-specific patterns

**Steps:**
1. Create `/home/samuel/sv/supervisor-service/.supervisor-core/scar-integration.md`
2. Write content (markdown)
3. Edit `src/instructions/InstructionAssembler.ts`:
   ```typescript
   const coreFiles = [
     'core-behaviors.md',
     'tool-usage.md',
     'bmad-methodology.md',
     'scar-integration.md',  // ADD THIS
   ];
   ```
4. Rebuild: `npm run build`
5. Run: `mcp__meta__propagate_instructions({})`
6. Done! All supervisors include new file.

### 3. Optimize Project After Changes

**Example:** Consilio added Supabase, want optimized instructions

**Steps:**
1. Run: `mcp__meta__adapt_project({ projectName: 'consilio', projectPath: '...' })`
2. AdaptLocalClaude detects Supabase in package.json
3. Generates Supabase-specific error handling guide
4. Updates `.claude-specific/consilio-custom.md`
5. Regenerates `consilio/CLAUDE.md`
6. Done! Consilio has Supabase-optimized instructions.

---

## How It Works

### Assembly Process

```
1. Read core files (.supervisor-core/)
2. Read meta-specific files (.supervisor-meta/) OR project-specific (.claude-specific/)
3. Assemble into CLAUDE.md:
   <!-- AUTO-GENERATED -->
   <!-- CORE INSTRUCTIONS -->
   [core-behaviors.md]
   [tool-usage.md]
   [bmad-methodology.md]
   <!-- END CORE INSTRUCTIONS -->

   <!-- PROJECT-SPECIFIC INSTRUCTIONS -->
   [consilio-custom.md]
   <!-- END PROJECT-SPECIFIC INSTRUCTIONS -->
4. Write to appropriate location
5. Report success/failure
```

### Tech Stack Detection

**AdaptLocalClaude analyzes:**
- `package.json` dependencies
- Build scripts
- Test frameworks
- Database libraries
- Deployment tools

**Generates:**
- Framework-specific error guides (React, Vue, etc.)
- Database-specific patterns (Supabase, PostgreSQL)
- Deployment checklists (Netlify, Vercel)
- Testing recommendations (Jest, Playwright)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  InstructionAssembler                                    │
│  - assembleForMeta()                                     │
│  - assembleForProject(name, path)                        │
│  - regenerateAll(projects)                               │
└──────────────────┬───────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────────┐  ┌───────────────────┐
│  .supervisor-core │  │  .supervisor-meta │
│  (shared)         │  │  (meta only)      │
└───────────────────┘  └───────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────────┐   ┌──────────────────┐
│  Meta CLAUDE.md  │   │ Project CLAUDE.md│
│  (auto-generated)│   │ (auto-generated) │
└──────────────────┘   └──────────────────┘
```

---

## MCP Tools Reference

### mcp__meta__propagate_instructions

**Purpose:** Regenerate all CLAUDE.md files from instruction layers

**Parameters:**
```typescript
{
  projects?: string[];     // Empty = all projects
  updateMeta?: boolean;    // Default: true
}
```

**Returns:**
```typescript
{
  success: boolean;
  updated: number;
  failed: number;
  results: Array<{
    name: string;
    success: boolean;
    path?: string;
    error?: string;
  }>;
  message: string;
}
```

**Example:**
```typescript
await mcp__meta__propagate_instructions({
  projects: [],      // All projects
  updateMeta: true   // Include meta-supervisor
});
```

### mcp__meta__adapt_project

**Purpose:** Analyze project and optimize supervisor instructions

**Parameters:**
```typescript
{
  projectName: string;   // Required
  projectPath: string;   // Required, absolute path
}
```

**Returns:**
```typescript
{
  success: boolean;
  projectName: string;
  analysis: {
    techStack: {
      language: string;
      framework?: string;
      database?: string;
      testingFramework?: string;
      deployment?: string;
    };
    recommendationsCount: number;
    recommendations: string[];
  };
  message: string;
}
```

**Example:**
```typescript
await mcp__meta__adapt_project({
  projectName: 'consilio',
  projectPath: '/home/samuel/supervisor/consilio'
});
```

---

## Manual Operations

### Rebuild After Changes

```bash
cd /home/samuel/sv/supervisor-service
npm run build
```

### Test Instruction Assembly

```bash
cd /home/samuel/sv/supervisor-service
node -e "
const { InstructionAssembler } = require('./dist/instructions/InstructionAssembler.js');

async function test() {
  const assembler = new InstructionAssembler();
  const metaContent = await assembler.assembleForMeta();
  console.log('Meta CLAUDE.md:', metaContent.length, 'characters');
}

test();
"
```

### View Generated CLAUDE.md

```bash
# Meta-supervisor
cat /home/samuel/sv/supervisor-service/CLAUDE.md

# Project supervisor (example: consilio)
cat /home/samuel/supervisor/consilio/CLAUDE.md
```

---

## Troubleshooting

### "File not found" Error

**Problem:** Core instruction file missing

**Solution:**
1. Check file exists: `ls .supervisor-core/`
2. Create missing file or remove from `coreFiles` array
3. Rebuild: `npm run build`

### "Project not found" Error

**Problem:** Project path incorrect

**Solution:**
1. Check project exists: `ls /home/samuel/supervisor/`
2. Use absolute path, not relative
3. Ensure project has `.claude-specific/` directory

### Changes Not Appearing

**Problem:** CLAUDE.md not regenerated

**Solution:**
1. Rebuild: `npm run build`
2. Run: `mcp__meta__propagate_instructions({})`
3. Check file timestamp: `ls -l {project}/CLAUDE.md`

### Tech Stack Not Detected

**Problem:** AdaptLocalClaude doesn't detect framework

**Solution:**
1. Check `package.json` exists
2. Check dependencies are listed
3. Add manual detection in `AdaptLocalClaude.ts`
4. Rebuild: `npm run build`

---

## Best Practices

### DO:
- ✅ Edit core files for shared behaviors
- ✅ Edit project-specific files for customizations
- ✅ Run propagate_instructions after core changes
- ✅ Use adapt_project after tech stack changes
- ✅ Preserve project-specific customizations

### DON'T:
- ❌ Edit CLAUDE.md directly (auto-generated)
- ❌ Delete `<!-- AUTO-GENERATED -->` markers
- ❌ Mix core and project-specific behaviors
- ❌ Forget to rebuild after TypeScript changes
- ❌ Overwrite project customizations

---

## File Size Reference

```
core-behaviors.md        ~6 KB   (autonomous supervision)
tool-usage.md            ~7 KB   (tool patterns)
bmad-methodology.md      ~7 KB   (BMAD workflow)
meta-specific.md         ~6 KB   (meta role)

InstructionAssembler.ts  ~9 KB   (assembly logic)
AdaptLocalClaude.ts      ~12 KB  (optimization logic)

Generated CLAUDE.md      ~26 KB  (meta-supervisor)
Generated CLAUDE.md      ~20 KB  (project-supervisor, avg)
```

---

## Quick Links

**Documentation:**
- Epic Breakdown: `/home/samuel/sv/supervisor-service/EPIC-BREAKDOWN-supervisor-service.md` (Epic 8)
- Implementation Summary: `/home/samuel/sv/supervisor-service/docs/epic-008-implementation-summary.md`
- Propagation System: `/home/samuel/sv/docs/supervisor-instruction-propagation-system.md`

**Source Code:**
- InstructionAssembler: `src/instructions/InstructionAssembler.ts`
- AdaptLocalClaude: `src/instructions/AdaptLocalClaude.ts`
- MCP Server: `src/mcp/server.ts` (tools added)

**Instruction Files:**
- Core: `.supervisor-core/`
- Meta: `.supervisor-meta/`
- Projects: `/home/samuel/supervisor/{project}/.claude-specific/`

---

**Last Updated:** 2026-01-18
**Epic:** 008 - Instruction Management
**Status:** ✅ Complete
