# AI Guide: TypeScript Analyzer for Intelligent Code Navigation

## Overview

This guide teaches AI agents how to use the TypeScript Analyzer to understand and modify codebases efficiently. Instead of reading entire files, you'll learn to navigate code like a surgeon - seeing only what matters.

## Core Philosophy

Functions are citizens in a universe. Your job as AI is to understand this universe and organize it wisely. The analyzer answers six fundamental questions for each function-citizen:

- **WHO**: Public/Private identity
- **WHAT**: Purpose and behavior
- **WHERE**: Location in the codebase
- **WHEN**: Temporal relationships (who calls whom)
- **HOW**: Implementation complexity
- **WHY**: Reason for existence

These questions are answered implicitly in the output - you don't see the questions, only the answers.

## The Most Effective Workflow

### Step 1: Understand the Universe (30 seconds)

Always start with:

```bash
npm run ts
```

This shows ALL functions in the codebase. Look for:

- Module organization (where similar functions live)
- Naming patterns (useX for hooks, handleX for handlers)
- Complexity markers [Complex] (refactoring opportunities)
- Export patterns [Export] vs [Internal]

Example output:

```
src/components
--------------------------------------------------
[Export] [Component] CTASection(CTASectionProps) [Complex]
  src/components/CTASection.tsx:15-278
[Export]  useAuth()
  src/hooks/useAuth.ts:23-115
```

From this you learn:

- CTASection is a complex component (needs attention)
- useAuth is a hook (reusable logic)
- File locations and line numbers for surgical reading

### Step 2: Find Specific Functions (10 seconds)

When you need something specific:

```bash
npm run ts find auth
```

This filters to show only auth-related functions. Use this when you:

- Need to understand a feature area
- Want to find all related functions
- Are looking for specific functionality

### Step 3: Analyze Architecture Health (20 seconds)

Before making changes, check the codebase health:

```bash
npm run ts analyze
```

This reveals:

- **Single-use functions** (should be inlined)
- **Overly connected functions** (need better organization)
- **Complex functions** (need breaking down)
- **Dead code** (can be removed)

Example:

```
Single-Use Functions (consider inlining):
- getEcosystemTypeFromTab (only called by MiniProfile)

Complex Functions (consider breaking down):
- MiniProfile (complexity: 55)
- AdminWaitlist (complexity: 18)
```

### Step 4: Read Only What Matters (1 minute)

Never read entire files. Instead:

```bash
npm run ts read useAuth hasPermission isAdmin
```

This generates sed commands to read ONLY those function bodies:

```bash
sed -n '23,115p' src/hooks/useAuth.ts
sed -n '6,18p' src/lib/permissions.ts
sed -n '21,23p' src/lib/permissions.ts
```

Run these commands in parallel to read multiple functions at once.

### Step 5: Understand Dependencies (10 seconds)

To see how functions connect:

```bash
npm run ts deps useAuth
```

This shows:

- What the function calls (dependencies)
- What calls this function (dependents)

### Step 6: Get Detailed Information (when needed)

For deep understanding of a specific function:

```bash
npm run ts info CTASection
```

This provides:

- Complete parameter types
- Return type
- Complexity score
- All dependencies
- Who calls it

## Practical Scenarios

### Scenario 1: Adding a New Feature

**Task**: Add user profile editing

1. **Find existing profile code**:

   ```bash
   npm run ts find profile
   ```

2. **Check complexity**:

   ```bash
   npm run ts info MiniProfile
   ```

3. **Read relevant functions**:

   ```bash
   npm run ts read MiniProfile useAuth
   ```

4. **Decision**: Create separate ProfileEdit component (MiniProfile is too complex at 55)

### Scenario 2: Refactoring Complex Code

**Task**: Simplify authentication flow

1. **Find all auth functions**:

   ```bash
   npm run ts find auth
   ```

2. **Analyze patterns**:

   ```bash
   npm run ts analyze
   ```

3. **Check dependencies**:

   ```bash
   npm run ts deps useAuth
   npm run ts deps isAdmin
   ```

4. **Decision**: Consolidate single-use helpers, break down complex functions

### Scenario 3: Understanding API Patterns

**Task**: Add new API endpoint

1. **Find existing API routes**:

   ```bash
   npm run ts find route
   ```

2. **Examine patterns**:

   ```bash
   npm run ts read GET POST
   ```

3. **Decision**: Follow established patterns in src/app/api/

## Key Principles for AI Agents

### 1. Never Read Entire Files

Use the analyzer to find exact line numbers, then read only those lines.

### 2. Understand Before Acting

Always run `npm run ts` first to see the universe before making changes.

### 3. Follow Established Patterns

The analyzer reveals patterns - follow them:

- Components in `src/components/`
- Hooks start with `use`
- API routes in `src/app/api/`

### 4. Respect Complexity Warnings

[Complex] tags indicate functions that need refactoring. Don't add to their complexity.

### 5. Check Health Regularly

Run `npm run ts analyze` to find inefficiencies before they become problems.

## Advanced Commands

### Get AI-Friendly Summary

```bash
npm run ts ai --module src/lib
```

Generates concise module overview for quick understanding.

### View Module Tree

```bash
npm run ts tree
```

Shows hierarchical organization of functions.

### Get Statistics

```bash
npm run ts stats
```

Shows project-wide metrics and patterns.

## Efficiency Gains

Traditional approach (reading files):

- Understanding codebase: 30+ minutes
- Finding patterns: 10+ minutes
- Making decisions: 10+ minutes
- **Total: 50+ minutes**

With TypeScript Analyzer:

- Understanding codebase: 30 seconds
- Finding patterns: 20 seconds
- Making decisions: 1 minute
- **Total: 2 minutes**

**25x faster with better understanding!**

## Remember

You are not just reading code - you are understanding a universe of function-citizens. Each function has a purpose, relationships, and a proper place. Use the analyzer to see the big picture, then zoom in surgically to exactly what you need.

The goal is not to read code, but to understand architecture and make intelligent decisions about where new code belongs.
