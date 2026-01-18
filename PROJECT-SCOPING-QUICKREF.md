# Project Scoping Quick Reference

## Environment Variable

```bash
PROJECT_NAME=meta          # Full access (all projects)
PROJECT_NAME=consilio      # Scoped to Consilio + meta
PROJECT_NAME=openhorizon   # Scoped to OpenHorizon + meta
```

## Access Rules

### Secrets

| PROJECT_NAME | Can Access |
|--------------|------------|
| `meta` | ALL secrets |
| `consilio` | `project/consilio/*` + `meta/*` |
| `openhorizon` | `project/openhorizon/*` + `meta/*` |

**Examples:**
```
meta/anthropic/api_key          ✅ All projects
meta/github/token               ✅ All projects
project/consilio/stripe_key     ✅ Consilio + meta only
project/openhorizon/aws_key     ✅ OpenHorizon + meta only
```

### Ports

| PROJECT_NAME | Can See |
|--------------|---------|
| `meta` | All port allocations |
| `consilio` | Only Consilio's ports (3100-3199) |
| `openhorizon` | Only OpenHorizon's ports (3200-3299) |

### Tasks

| PROJECT_NAME | Can See |
|--------------|---------|
| `meta` | All task statistics |
| `consilio` | Only Consilio's task history |
| `openhorizon` | Only OpenHorizon's task history |

## Test Commands

```bash
# Test scoping logic
node test-scoping-simple.js

# Build project
npm run build

# Run MCP server as meta
PROJECT_NAME=meta npm run mcp

# Run MCP server as consilio
PROJECT_NAME=consilio npm run mcp
```

## Claude.ai Project Configuration

### Meta Supervisor (Full Access)

```json
{
  "env": {
    "PROJECT_NAME": "meta"
  }
}
```

### Consilio (Scoped Access)

```json
{
  "env": {
    "PROJECT_NAME": "consilio"
  }
}
```

### OpenHorizon (Scoped Access)

```json
{
  "env": {
    "PROJECT_NAME": "openhorizon"
  }
}
```

## Security Guarantees

- ✅ Enforced at server level (not client-side)
- ✅ Cannot be bypassed by prompts
- ✅ Errors returned for unauthorized access
- ✅ Each project isolated from others
- ✅ Meta secrets shared across all projects

## Files Modified

- `src/mcp/server.ts` - Added filtering logic to handlers

## Files Created

- `test-scoping-simple.js` - Unit tests for scoping logic
- `PROJECT-SCOPING-IMPLEMENTATION.md` - Full documentation
- `PROJECT-SCOPING-QUICKREF.md` - This file
