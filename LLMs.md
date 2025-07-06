# FOS for LLMs: Function Operating System

## What is FOS?

FOS treats functions as "citizens in a universe" - a TypeScript analyzer that provides raw function data for AI agents to process. It enables surgical precision reading of TypeScript codebases.

## Core Philosophy

- **Functions are the atomic unit of programming**
- **AI agents need raw data, not processed visualizations**
- **Every function tells WHO, WHAT, WHERE, WHEN, HOW, WHY**
- **Module-specific queries for focused analysis**

## Installation

```bash
npm install -g function-os
```

## Commands

### `fos` or `fos list [module]`
Lists all functions or functions in a specific module.

**Examples:**
```bash
fos                           # All functions in codebase
fos src/app                   # Functions in src/app directory
fos src/telegram/voice        # Functions in specific path
fos voice                     # Smart resolution: finds voice.ts
```

**Output format:**
```
functionName:
  type: arrow|function|method|constructor|getter|setter
  async: true|false
  exported: true|false
  location: path/to/file.ts:startLine-endLine
  params:
    - paramName: type
  returns: ReturnType
  calls:
    → calledFunction
  complexity: number
```

### `fos find <pattern>`
Search functions by regex pattern.

```bash
fos find "^use"              # Find all React hooks
fos find "handle.*"          # Find all handlers
fos find "test|spec"         # Find test functions
```

### `fos info <function>`
Show detailed information about a specific function.

```bash
fos info useAuth             # Details about useAuth function
fos info handleSubmit        # Details about handleSubmit
```

### `fos deps <function>`
Show what a function depends on (calls).

```bash
fos deps processOrder        # What processOrder calls
fos deps useAuth            # What useAuth depends on
```

### `fos callers <function>`
Show what functions call this function.

```bash
fos callers validateEmail    # Who calls validateEmail
fos callers saveToDatabase   # Who calls saveToDatabase
```

### `fos type <typeName>`
Show TypeScript type definitions.

```bash
fos type UserProfile         # Show UserProfile interface
fos type APIResponse         # Show APIResponse type
```

## AI Agent Integration Patterns

### 1. Codebase Overview
```bash
# Get all functions to understand project structure
fos
```

### 2. Module Analysis
```bash
# Analyze specific feature
fos src/features/auth
fos src/api/endpoints
```

### 3. Function Discovery
```bash
# Find related functions
fos find "auth|Auth"
fos find "^handle"
fos find "Effect$"
```

### 4. Dependency Tracing
```bash
# Understand function relationships
fos deps processPayment
fos callers validateUser
```

### 5. Smart File Resolution
```bash
# FOS intelligently resolves paths
fos voice         # Finds voice.ts or voice.tsx
fos auth          # Finds auth module (file or folder)
fos UserProfile   # Finds UserProfile.tsx
```

## Key Features for AI Agents

1. **Nested Function Detection**: Finds functions inside objects and other functions
2. **Smart Path Resolution**: Handles files with/without extensions
3. **Raw Data Output**: Structured data ready for AI processing
4. **Module Filtering**: Analyze specific parts of large codebases
5. **Relationship Mapping**: Understand function dependencies

## Output Characteristics

- **Function locations**: `file:startLine-endLine` for precise navigation
- **Export status**: Distinguish public API from internal functions
- **Async detection**: Identify asynchronous operations
- **Parameter details**: Types, optionality, and defaults
- **Call graph**: What each function calls
- **State modifications**: Track side effects

## Performance Notes

- First run analyzes entire codebase (~30 seconds for large projects)
- Subsequent runs use cached analysis
- Module-specific queries reduce output size
- Regex patterns filter results efficiently

## Integration Example

```javascript
// AI agent pseudocode
const output = exec('fos find "^use"');
const hooks = parseOutput(output);

hooks.forEach(hook => {
  const deps = exec(`fos deps ${hook.name}`);
  const callers = exec(`fos callers ${hook.name}`);
  // Analyze hook usage patterns
});
```

## Constraints

- Requires TypeScript project with tsconfig.json
- Only analyzes .ts and .tsx files
- Anonymous functions are excluded
- Skips node_modules and build directories

## Philosophy

FOS provides **raw function data** - not visualizations, not opinions, just facts about functions. AI agents can process this data to understand codebases, trace dependencies, and analyze patterns. The tool focuses on **mental efficiency** by treating functions as first-class citizens in a queryable universe.