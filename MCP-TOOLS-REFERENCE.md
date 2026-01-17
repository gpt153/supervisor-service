# MCP Tools Reference

Quick reference for all 27 supervisor MCP tools.

## Planning Tools (6)

### list_epics
**Purpose:** List all epics for a project
**Parameters:**
- `project` (string, required) - Project name

**Example:**
```json
{
  "project": "consilio"
}
```

**Returns:**
```json
{
  "success": true,
  "project": "consilio",
  "count": 5,
  "epics": [
    {
      "filename": "001-authentication.md",
      "title": "User Authentication System",
      "status": "In Progress"
    }
  ]
}
```

### read_epic
**Purpose:** Read epic content
**Parameters:**
- `project` (string, required)
- `epic_file` (string, required) - e.g., "001-feature.md"

### list_adrs
**Purpose:** List Architecture Decision Records
**Parameters:**
- `project` (string, required)

### read_adr
**Purpose:** Read ADR content
**Parameters:**
- `project` (string, required)
- `adr_file` (string, required)

### read_workflow_status
**Purpose:** Get project progress/status
**Parameters:**
- `project` (string, required)

### list_templates
**Purpose:** List available BMAD templates
**Parameters:** None

## Git Tools (4)

### git_status
**Purpose:** Get git status for planning directory
**Parameters:**
- `project` (string, required)

**Returns:**
```json
{
  "success": true,
  "project": "consilio",
  "branch": "main",
  "status": "M CLAUDE.md\n?? new-file.md",
  "has_changes": true
}
```

### git_commit
**Purpose:** Create git commit
**Parameters:**
- `project` (string, required)
- `message` (string, required)
- `files` (array, optional) - Specific files, or all if omitted

### git_push
**Purpose:** Push to remote
**Parameters:**
- `project` (string, required)
- `remote` (string, optional) - Default: "origin"
- `branch` (string, optional) - Default: current branch

### git_log
**Purpose:** Get recent commits
**Parameters:**
- `project` (string, required)
- `limit` (number, optional) - Default: 10

## GitHub Tools (5)

### list_issues
**Purpose:** List GitHub issues
**Parameters:**
- `owner` (string, required)
- `repo` (string, required)
- `state` (string, optional) - "open", "closed", "all"
- `labels` (array, optional)

**Example:**
```json
{
  "owner": "gpt153",
  "repo": "consilio",
  "state": "open",
  "labels": ["enhancement"]
}
```

### read_issue
**Purpose:** Get issue details with comments
**Parameters:**
- `owner` (string, required)
- `repo` (string, required)
- `issue_number` (number, required)
- `include_comments` (boolean, optional) - Default: true

### create_issue
**Purpose:** Create new GitHub issue
**Parameters:**
- `owner` (string, required)
- `repo` (string, required)
- `title` (string, required)
- `body` (string, required)
- `labels` (array, optional)

### comment_issue
**Purpose:** Add comment to issue
**Parameters:**
- `owner` (string, required)
- `repo` (string, required)
- `issue_number` (number, required)
- `body` (string, required)

### close_issue
**Purpose:** Close an issue
**Parameters:**
- `owner` (string, required)
- `repo` (string, required)
- `issue_number` (number, required)

## SCAR Monitoring Tools (4)

### check_scar_progress
**Purpose:** Check SCAR's latest activity
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)

**Returns:**
```json
{
  "success": true,
  "status": "in_progress",
  "files_count": 15,
  "last_activity": {
    "file": "./src/auth.ts",
    "modified": "2026-01-17T14:30:00Z",
    "minutes_ago": 5
  }
}
```

### list_worktrees
**Purpose:** List active worktrees
**Parameters:**
- `project` (string, required)

### read_worktree_files
**Purpose:** List files in worktree
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)
- `pattern` (string, optional) - e.g., "*.ts"

### check_file_timestamps
**Purpose:** Get file modification times
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)
- `files` (array, optional) - Specific files to check

## Verification Tools (4)

### trigger_verification
**Purpose:** Run full verification suite
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)

**Returns:**
```json
{
  "success": true,
  "verification_id": "uuid",
  "status": "passed",
  "build_success": true,
  "tests_passed": true,
  "mocks_detected": false,
  "summary": "All checks passed!"
}
```

### get_verification_results
**Purpose:** Get historical verification results
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)
- `limit` (number, optional) - Default: 5

### run_build
**Purpose:** Execute build in worktree
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)

### run_tests
**Purpose:** Execute tests in worktree
**Parameters:**
- `project` (string, required)
- `issue_number` (number, required)

## Knowledge Tools (4)

### search_learnings
**Purpose:** Search supervisor learnings
**Parameters:**
- `query` (string, required)
- `category` (string, optional) - e.g., "scar-integration"

**Example:**
```json
{
  "query": "verification",
  "category": "scar-integration"
}
```

### read_learning
**Purpose:** Read specific learning
**Parameters:**
- `filename` (string, required) - e.g., "006-never-trust-scar.md"

### list_docs
**Purpose:** List documentation files
**Parameters:**
- `pattern` (string, optional) - e.g., "scar-*"

### read_doc
**Purpose:** Read documentation
**Parameters:**
- `filename` (string, required)

## Common Patterns

### Monitor SCAR Progress
```
1. check_scar_progress(project, issue_number)
2. If status = "in_progress", check minutes_ago
3. If > 30 minutes, check worktree files
4. If complete, trigger_verification
```

### Create Epic → GitHub Issue → Monitor
```
1. list_epics(project) - Find next epic
2. read_epic(project, epic_file) - Get content
3. create_issue(owner, repo, title, body) - Create issue
4. check_scar_progress(project, issue_number) - Monitor
5. trigger_verification(project, issue_number) - Verify
```

### Verify Implementation
```
1. check_scar_progress(project, issue_number)
2. If status = "in_progress", wait
3. trigger_verification(project, issue_number)
4. If status = "passed", comment_issue with approval
5. If status = "failed", comment_issue with feedback
```

## Error Handling

All tools return structured errors:
```json
{
  "error": "Failed to read epic: ENOENT: no such file or directory",
  "success": false
}
```

Always check `success` field in responses.
