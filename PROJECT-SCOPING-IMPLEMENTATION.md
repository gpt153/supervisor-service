# Project Scoping Implementation

**Status:** ✅ IMPLEMENTED AND TESTED

## Summary

Added project-scoping middleware to MCP server to ensure different Claude.ai Projects see only their own data.

## Changes Made

### 1. Added PROJECT_NAME Environment Variable

**File:** `src/mcp/server.ts`

```typescript
// Project scoping - defaults to 'meta' for full access
const projectName = process.env.PROJECT_NAME || 'meta';
console.error(`MCP Server initialized for project: ${projectName}`);
```

**Usage:**
- `PROJECT_NAME=meta` → Full access (all secrets, ports, tasks)
- `PROJECT_NAME=consilio` → Scoped access (only Consilio + meta data)
- `PROJECT_NAME=openhorizon` → Scoped access (only OpenHorizon + meta data)

### 2. Updated Tool Descriptions

All affected tools now mention project scoping in their descriptions:

- `mcp__meta__retrieve_secret` → "Retrieve and decrypt a secret by key path (project-scoped for \"consilio\")"
- `mcp__meta__list_secrets` → "List all secrets accessible to project \"consilio\""
- `mcp__meta__list_ports` → "List port allocations for project \"consilio\""
- `mcp__meta__get_task_stats` → "Get execution statistics for project \"consilio\""

### 3. Implemented Filtering Logic

#### retrieve_secret Handler

```typescript
case 'mcp__meta__retrieve_secret': {
  const keyPath = args.keyPath as string;

  // Project scoping: Only allow access to project's secrets and meta secrets
  if (projectName !== 'meta') {
    const allowedPrefixes = [`project/${projectName}/`, 'meta/'];
    const isAllowed = allowedPrefixes.some(prefix => keyPath.startsWith(prefix));

    if (!isAllowed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Access denied: Project "${projectName}" can only access secrets with keyPath starting with "project/${projectName}/" or "meta/"`
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  const value = await secretsManager.retrieve(keyPath);
  // ... rest of handler
}
```

**Behavior:**
- Meta project: Can retrieve ANY secret
- Other projects: Can ONLY retrieve `project/{projectName}/*` or `meta/*` secrets
- Returns error for unauthorized access attempts

#### list_secrets Handler

```typescript
case 'mcp__meta__list_secrets': {
  let secrets = await secretsManager.list({
    provider: args.provider as string | undefined,
    secretType: args.secretType as string | undefined,
  });

  // Project scoping: Filter secrets by keyPath prefix
  if (projectName !== 'meta') {
    secrets = secrets.filter(s =>
      s.keyPath.startsWith(`project/${projectName}/`) ||
      s.keyPath.startsWith('meta/')
    );
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        count: secrets.length,
        projectScope: projectName,
        secrets: secrets.map(s => ({...}))
      }, null, 2)
    }]
  };
}
```

**Behavior:**
- Meta project: Sees ALL secrets
- Consilio project: Sees only `project/consilio/*` and `meta/*` secrets
- OpenHorizon project: Sees only `project/openhorizon/*` and `meta/*` secrets

#### list_ports Handler

```typescript
case 'mcp__meta__list_ports': {
  // Project scoping: Override projectName filter if not meta
  const filterProjectName = projectName === 'meta'
    ? (args.projectName as string | undefined)
    : projectName;

  const allocations = await portManager.listAllocations(
    filterProjectName,
    args.includeReleased as boolean | undefined
  );

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        count: allocations.length,
        projectScope: projectName,
        allocations
      }, null, 2)
    }]
  };
}
```

**Behavior:**
- Meta project: Can list ports for any project (or all projects)
- Other projects: Can ONLY list their own ports (filter is forced)

#### get_task_stats Handler

```typescript
case 'mcp__meta__get_task_stats': {
  // Project scoping: Override projectName filter if not meta
  const filterProjectName = projectName === 'meta'
    ? (args.projectName as string | undefined)
    : projectName;

  const stats = await taskTimer.getStats({
    taskType: args.taskType as string | undefined,
    projectName: filterProjectName,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        projectScope: projectName,
        stats
      }, null, 2)
    }]
  };
}
```

**Behavior:**
- Meta project: Can get stats for any project (or all projects)
- Other projects: Can ONLY get their own task stats (filter is forced)

## Testing

### Unit Test: Scoping Logic

**File:** `test-scoping-simple.js`

**Results:** ✅ ALL TESTS PASSED (6/6)

```
Test 1: Meta can access any project secret → ✓ PASS
Test 2: Meta can access meta secrets → ✓ PASS
Test 3: Consilio can access own secrets → ✓ PASS
Test 4: Consilio can access meta secrets → ✓ PASS
Test 5: Consilio CANNOT access OpenHorizon secrets → ✓ PASS
Test 6: OpenHorizon CANNOT access Consilio secrets → ✓ PASS
```

### Build Test

```bash
npm run build
```

**Result:** ✅ SUCCESS (no TypeScript errors)

## Security Model

### Access Matrix

| Project | Can Access Secrets | Can Access Ports | Can Access Tasks |
|---------|-------------------|------------------|------------------|
| **meta** | ALL secrets | ALL ports | ALL tasks |
| **consilio** | `project/consilio/*` + `meta/*` | Consilio's range | Consilio's tasks |
| **openhorizon** | `project/openhorizon/*` + `meta/*` | OpenHorizon's range | OpenHorizon's tasks |

### Key Paths Convention

**Secrets:**
- `meta/*` → Shared across all projects (e.g., `meta/anthropic/api_key`)
- `project/{name}/*` → Project-specific (e.g., `project/consilio/stripe_key`)

**Example:**
```
meta/anthropic/api_key          ← All projects can access
meta/github/token               ← All projects can access
project/consilio/stripe_key     ← Only Consilio + meta
project/consilio/db_password    ← Only Consilio + meta
project/openhorizon/aws_key     ← Only OpenHorizon + meta
```

## Usage in Claude.ai Projects

### Meta Supervisor Project

```json
{
  "env": {
    "PROJECT_NAME": "meta",
    "DB_HOST": "/var/run/postgresql",
    "DB_PORT": "5434",
    "DB_NAME": "supervisor",
    "DB_USER": "supervisor_user",
    "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
  }
}
```

**Capabilities:**
- See ALL secrets from all projects
- Manage ALL port allocations
- View ALL task statistics
- Create new projects and port ranges

### Consilio Planning Project

```json
{
  "env": {
    "PROJECT_NAME": "consilio",
    "DB_HOST": "/var/run/postgresql",
    "DB_PORT": "5434",
    "DB_NAME": "supervisor",
    "DB_USER": "supervisor_user",
    "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
  }
}
```

**Capabilities:**
- See ONLY Consilio secrets (`project/consilio/*`) + shared meta secrets
- See ONLY Consilio's port allocations
- See ONLY Consilio's task history
- CANNOT see OpenHorizon, Health-Agent, or other projects' data

### OpenHorizon Planning Project

```json
{
  "env": {
    "PROJECT_NAME": "openhorizon",
    "DB_HOST": "/var/run/postgresql",
    "DB_PORT": "5434",
    "DB_NAME": "supervisor",
    "DB_USER": "supervisor_user",
    "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
  }
}
```

**Capabilities:**
- See ONLY OpenHorizon secrets (`project/openhorizon/*`) + shared meta secrets
- See ONLY OpenHorizon's port allocations
- See ONLY OpenHorizon's task history
- CANNOT see Consilio, Health-Agent, or other projects' data

## Benefits

### 1. Project Isolation
- ✅ Consilio supervisor cannot leak OpenHorizon API keys
- ✅ OpenHorizon supervisor cannot see Consilio database credentials
- ✅ Each project has isolated context

### 2. Shared Resources
- ✅ All projects can access shared meta secrets (Anthropic API key, GitHub token)
- ✅ Meta supervisor maintains full visibility for debugging

### 3. Security
- ✅ Enforced at MCP server level (not client-side)
- ✅ Cannot be bypassed by malicious prompts
- ✅ Errors returned for unauthorized access attempts

### 4. Multi-tenancy
- ✅ Same database, same MCP server code
- ✅ Different PROJECT_NAME = different scope
- ✅ Easy to add new projects (just set env var)

## Future Enhancements

### Possible Additions

1. **Project-level permissions matrix** (database table)
   - Allow fine-grained access control
   - Example: "consilio can read openhorizon secrets but not write"

2. **Audit logging**
   - Log all secret access attempts
   - Track which project accessed what

3. **Secret sharing**
   - Allow projects to explicitly share secrets
   - Example: `project/consilio/shared/api_key` accessible to multiple projects

4. **Rate limiting per project**
   - Prevent one project from exhausting resources

## References

- Setup guide: `/home/samuel/supervisor/supervisor-service/docs/CLAUDE-AI-PROJECTS-SETUP.md`
- Server implementation: `/home/samuel/supervisor/supervisor-service/src/mcp/server.ts`
- Test suite: `/home/samuel/supervisor/supervisor-service/test-scoping-simple.js`

---

**Implementation Date:** 2026-01-18
**Status:** ✅ COMPLETE AND TESTED
