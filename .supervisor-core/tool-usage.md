# Tool Usage Patterns

**Version:** 1.0
**Last Updated:** 2026-01-18
**Applies To:** All supervisors

---

## MCP Tool Usage Guidelines

### When to Use MCP Tools

**MCP tools are for:**
- ✅ Secrets management (store/retrieve API keys)
- ✅ Port allocation (manage service ports)
- ✅ Task timing (track execution time)
- ✅ Instruction propagation (update supervisors)
- ✅ Cloudflare operations (DNS, tunnel)
- ✅ GCloud operations (VM management)

**Use MCP tools when:**
- Data needs to persist across sessions
- Operation affects multiple projects
- Security required (encryption)
- Cross-system coordination needed

### When to Use Direct Tools

**File Operations:**
- ✅ Read - For reading files
- ✅ Edit - For editing existing files
- ✅ Write - For creating new files
- ❌ NOT bash cat/echo/sed

**Search Operations:**
- ✅ Grep - For content search
- ✅ Glob - For file pattern matching
- ❌ NOT bash find/grep

**Code Operations:**
- ✅ Edit - For precise code changes
- ❌ NOT bash sed/awk

---

## File Tool Patterns

### Reading Files

**Use Read tool:**
```
Read file_path=/absolute/path/to/file.ts
```

**Don't use bash:**
```bash
# ❌ Wrong
cat /path/to/file.ts

# ❌ Wrong
head -n 100 /path/to/file.ts
```

**When to use offset/limit:**
- File is very large (>2000 lines)
- Only need specific section
- Performance matters

### Editing Files

**Use Edit tool for precise changes:**
```
Edit:
  file_path: /absolute/path/to/file.ts
  old_string: "const port = 3000;"
  new_string: "const port = 8080;"
```

**Don't use bash:**
```bash
# ❌ Wrong
sed -i 's/3000/8080/g' file.ts

# ❌ Wrong
echo "const port = 8080;" >> file.ts
```

### Writing Files

**Use Write tool for new files:**
```
Write:
  file_path: /absolute/path/to/new-file.ts
  content: |
    export class Example {
      ...
    }
```

**Don't use bash:**
```bash
# ❌ Wrong
cat > file.ts << EOF
content here
EOF

# ❌ Wrong
echo "content" > file.ts
```

---

## Search Tool Patterns

### Content Search (Grep)

**Use Grep tool:**
```
Grep:
  pattern: "class.*Manager"
  path: /path/to/search
  output_mode: content
  glob: "*.ts"
```

**Don't use bash grep:**
```bash
# ❌ Wrong
grep -r "class.*Manager" /path/to/search

# ❌ Wrong
rg "class.*Manager" /path/to/search
```

### File Pattern Search (Glob)

**Use Glob tool:**
```
Glob:
  pattern: "**/*.test.ts"
  path: /path/to/search
```

**Don't use bash find:**
```bash
# ❌ Wrong
find /path -name "*.test.ts"

# ❌ Wrong
ls -R | grep "test.ts"
```

---

## Bash Tool - When to Use

**Use Bash ONLY for:**

1. **Git operations:**
   ```bash
   git status
   git add .
   git commit -m "message"
   git push
   ```

2. **Process management:**
   ```bash
   systemctl status service
   pm2 list
   docker ps
   ```

3. **Network operations:**
   ```bash
   curl https://api.example.com
   nc -zv host port
   ```

4. **Complex operations:**
   ```bash
   npm install
   npm run build
   pytest
   ```

5. **System information:**
   ```bash
   df -h
   free -m
   top -bn1
   ```

**Don't use Bash for:**
- ❌ Reading files (use Read)
- ❌ Editing files (use Edit)
- ❌ Writing files (use Write)
- ❌ Searching content (use Grep)
- ❌ Finding files (use Glob)

---

## Subagent Patterns

### When to Spawn Subagents

**Use Task tool (subagent) for:**

1. **Complex workflows:**
   - Epic creation
   - Issue supervision
   - Verification loops

2. **Long-running operations:**
   - SCAR monitoring (2-min loops)
   - Build verification
   - Deployment processes

3. **Context-heavy operations:**
   - Codebase analysis
   - Architecture review
   - Testing strategies

4. **Parallel operations:**
   - Multiple independent epics
   - Parallel verification
   - Multi-project updates

### Subagent Communication

**Provide clear instructions:**
```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet", // or "haiku" for simple tasks
  prompt: `
    Create epic for feature: User Authentication

    Use instructions from: /path/to/create-epic.md

    Working directory: /path/to/project

    Return:
    - Epic file path
    - Task breakdown
    - Estimated time
  `,
  description: "Create user authentication epic"
})
```

### Model Selection for Subagents

**Use Haiku (fast & cheap) for:**
- ✅ Simple verification (file exists, SCAR acknowledged)
- ✅ Monitoring loops (polling status)
- ✅ Simple status checks
- ✅ Context handoff routing

**Use Sonnet for:**
- ✅ Complex decision-making
- ✅ Plan evaluation
- ✅ Code analysis
- ✅ Architecture decisions
- ✅ Epic creation
- ✅ Verification with build/test

**Cost savings:**
- Haiku: ~60-70% cheaper than Sonnet
- Use Haiku for 2-min monitoring loops
- Preserve Sonnet for complex thinking

---

## Tool Combination Patterns

### File Read + Edit Pattern

**Correct:**
```
1. Read file to see current content
2. Edit file with precise old_string → new_string
```

**Wrong:**
```
1. Bash cat file
2. Bash sed to edit
```

### Search + Read Pattern

**Correct:**
```
1. Grep to find files with pattern
2. Read specific files found
```

**Wrong:**
```
1. Bash grep
2. Bash cat results
```

### Multi-file Update Pattern

**Correct:**
```
1. Glob to find all matching files
2. For each file:
   a. Read current content
   b. Edit with specific changes
```

**Wrong:**
```
Bash: for file in *.ts; do sed -i 's/old/new/g' $file; done
```

---

## Performance Considerations

### Parallel Tool Calls

**When operations are independent:**
```
Call multiple tools in same message:
- Read file1
- Read file2
- Read file3
```

**When operations depend on each other:**
```
Sequential calls:
1. Read file to analyze
2. (wait for result)
3. Edit file based on analysis
```

### Batch Operations

**Good:**
```
Use Glob once to find all files
Then Read each in parallel
Then Edit each sequentially
```

**Bad:**
```
For each file:
  Bash find
  Bash cat
  Bash sed
```

---

## Error Handling

### Tool Errors

**If Read fails:**
- Check file path is absolute
- Check file exists (use Glob)
- Check permissions

**If Edit fails:**
- Verify old_string is unique
- Check file was read first
- Consider using replace_all

**If Grep fails:**
- Check pattern syntax (ripgrep format)
- Verify path exists
- Try broader pattern

### Bash Errors

**If bash command fails:**
1. Check working directory
2. Verify command exists
3. Check permissions
4. Add error handling (|| echo "failed")
5. Retry with adjusted command

---

**Remember: Use specialized tools over bash whenever possible. They're more reliable, safer, and preserve context.**
