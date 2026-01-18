# BMAD Methodology

**Version:** 1.0
**Last Updated:** 2026-01-18
**Applies To:** All project supervisors

---

## What is BMAD?

**B**uild **M**inimally **A**daptable **D**esign

A lightweight planning methodology that scales intelligence to task complexity.

**Core Principle:** Match planning effort to task difficulty. Don't over-plan simple tasks, don't under-plan complex features.

---

## Planning Artifacts

### 1. Project Brief (One-Time)

**Created:** At project start
**Purpose:** High-level vision and goals
**File:** `project-brief.md`

**Contents:**
- Problem statement
- Target users
- Core value proposition
- Success metrics
- Tech stack decision
- Out of scope

**When to update:**
- Major pivot
- New stakeholders
- Scope expansion

### 2. Epic (Per Feature)

**Created:** For each major feature
**Purpose:** Break feature into implementable chunks
**File:** `epics/epic-XXX.md`

**Structure:**
```markdown
# Epic XXX: [Feature Name]

## Overview
Brief description of feature

## User Stories
- As a [user], I want [goal] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Tasks
1. Task 1
2. Task 2

## Dependencies
- Epic-001 must complete first
- Requires API key from user

## Estimated Effort
- Simple/Medium/Complex
- X-Y hours with AI agents

## Out of Scope
- Not doing X in this epic
- Y is future enhancement
```

**Epic Size Guidelines:**
- **Small:** 1-3 tasks, <4 hours
- **Medium:** 4-8 tasks, 4-12 hours
- **Large:** 9-15 tasks, 12-24 hours
- **Too Large:** >15 tasks → Split into multiple epics

### 3. ADR (Architecture Decision Record)

**Created:** For significant technical decisions
**Purpose:** Document why we chose X over Y
**File:** `adrs/adr-XXX-decision-name.md`

**When to create:**
- Choosing database (PostgreSQL vs MongoDB)
- Authentication approach (JWT vs sessions)
- State management (Redux vs Zustand)
- Deployment platform (Vercel vs Netlify)
- Major architecture changes

**Structure:**
```markdown
# ADR XXX: [Decision Title]

**Status:** Accepted / Superseded
**Date:** 2026-01-18
**Deciders:** [Who decided]

## Context
What's the situation and problem?

## Decision
What did we decide?

## Consequences
### Positive
- Pro 1
- Pro 2

### Negative
- Con 1
- Con 2

### Neutral
- Thing 1
- Thing 2

## Alternatives Considered
1. Option A - rejected because...
2. Option B - rejected because...
```

**Don't create ADR for:**
- Trivial choices (linting rules, formatting)
- Obvious decisions (use TypeScript in TypeScript project)
- Reversible choices (can change easily later)

---

## MoSCoW Prioritization

**For each task/feature, assign:**

### Must Have (P0)
- Core functionality
- Blocking other work
- Security-critical
- User-facing bug fixes

**Examples:**
- User authentication
- Database setup
- Payment processing
- Critical security patches

### Should Have (P1)
- Important but not critical
- Enhances core features
- Performance improvements
- Nice UX improvements

**Examples:**
- Password reset flow
- Email notifications
- Loading states
- Error messages

### Could Have (P2)
- Nice to have
- Polish features
- Minor improvements
- Edge cases

**Examples:**
- Social login
- Dark mode
- Animations
- Admin dashboard

### Won't Have (This Epic)
- Out of scope for now
- Future enhancements
- Deferred to later

**Examples:**
- Multi-language support
- Mobile app
- Advanced analytics
- Third-party integrations

---

## Scale-Adaptive Intelligence

**Match thinking to complexity:**

### Simple Tasks (P0, <1 hour)
**Planning:**
- Quick epic (1 paragraph)
- No ADR needed
- Obvious implementation

**Examples:**
- Add environment variable
- Update button text
- Fix typo in docs
- Add console.log

**Approach:**
- Read relevant files
- Make change
- Test
- Commit

### Medium Tasks (P1, 1-4 hours)
**Planning:**
- Full epic with tasks
- ADR if technical decision
- Consider alternatives

**Examples:**
- Add new API endpoint
- Implement form validation
- Add new page
- Update database schema

**Approach:**
- Create epic
- Research patterns
- Implement incrementally
- Test thoroughly
- Document

### Complex Tasks (P0, 4+ hours)
**Planning:**
- Detailed epic with subtasks
- Multiple ADRs possible
- Prototype if uncertain
- Spike to reduce risk

**Examples:**
- Real-time collaboration
- Payment integration
- Authentication system
- Database migration

**Approach:**
- Deep research
- Create ADRs
- Prototype risky parts
- Break into smaller epics
- Implement incrementally
- Extensive testing
- Comprehensive docs

---

## Epic Creation Workflow

### 1. Understand Request
- Read user's feature request
- Ask clarifying questions
- Identify unknowns

### 2. Research (if needed)
- Search codebase for similar features
- Check existing patterns
- Review tech stack capabilities

### 3. Break Down
- Identify core components
- List tasks in order
- Mark dependencies
- Estimate effort

### 4. Write Epic
- Clear overview
- Specific acceptance criteria
- Ordered task list
- Dependencies noted
- Effort estimated

### 5. Create GitHub Issue
- Epic content becomes issue body
- Apply labels
- Link related issues
- Assign to SCAR

---

## Validation Strategy

**Include in every epic:**

### Unit Tests
- Test individual functions
- Mock dependencies
- Cover edge cases

### Integration Tests
- Test component interactions
- Real dependencies (test DB)
- API endpoint testing

### E2E Tests (if UI)
- User workflows
- Critical paths
- Cross-browser (if needed)

### Manual Verification
- Human check after tests
- Visual inspection
- Production-like testing

**Test Coverage Goals:**
- Core features: 80%+ coverage
- Utils/helpers: 90%+ coverage
- UI components: 60%+ (harder to test)

---

## Dependencies Management

### Identify Dependencies Early
- What must complete first?
- What can run in parallel?
- External dependencies (APIs, keys)?

### Document Dependencies
```markdown
## Dependencies

**Blocks:**
- Epic-001 (database schema)
- Epic-005 (authentication)

**Blocked by:**
- API key from user
- Design mockups

**Can parallelize with:**
- Epic-007 (frontend)
- Epic-008 (tests)
```

### Handle Blockers
- Start parallel work
- Create stub/mock for blocked work
- Notify user of external dependencies
- Re-prioritize if long wait

---

## Epic Sharding (Context Conservation)

**When epic is too large for single context:**

### Option 1: Split into Multiple Epics
```
Epic-003: User Authentication
  → Epic-003a: Backend Auth API
  → Epic-003b: Frontend Auth UI
  → Epic-003c: Auth Testing
```

### Option 2: Phase-based Handoffs
```
Epic-003 Phase 1: Research & Design
  → Write handoff doc
  → New session picks up Phase 2: Implementation
```

### Option 3: Component-based Split
```
Epic-003: Dashboard
  → Issue #10: Dashboard API
  → Issue #11: Dashboard UI
  → Issue #12: Dashboard Charts
```

**Signals to shard:**
- Epic has >15 tasks
- Estimated >24 hours
- Multiple independent components
- Different skill sets needed

---

## Completion Checklist

**Before marking epic complete:**

- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Tests written and passing
- [ ] Code reviewed (by SCAR or self)
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Staging verification passed
- [ ] Deployed to production
- [ ] Production verification passed
- [ ] User notified (if applicable)

**Don't skip steps.** Done means DONE.

---

**BMAD keeps planning lightweight but thorough. Plan enough, not more.**
