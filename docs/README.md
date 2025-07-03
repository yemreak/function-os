# Function Operating System (FOS)

**Built by AI for AI** - Eliminates function discovery pain for NADRAI agents and developers. Understand TypeScript codebases 95% faster through function relationships.

## Installation

```bash
# Global installation (recommended)
npm install -g function-os

# Or use locally in a project
npm install --save-dev function-os
```

## Quick Start

```bash
# In any TypeScript project directory
fos                     # List all functions
fos find auth          # Find auth-related functions
fos info useAuth       # Detailed function information
fos analyze            # Find code inefficiencies
```

## Core Commands

### List Functions

```bash
fos                    # List all functions (default)
fos list --exports     # Only exported functions
fos list --complex     # Only complex functions (complexity > 10)
fos list --module src/lib  # Functions in specific module
```

### Search Functions

```bash
fos find auth          # Find functions with "auth" in name
fos find handle        # Find all handlers
fos find use           # Find all React hooks
```

### Function Details

```bash
fos info useAuth       # Show complete function details
fos deps useAuth       # Show what function calls (project only)
fos callers useAuth    # Show what calls this function
fos flow useAuth       # Trace complete call flow
fos graph useAuth      # Visual dependency graph
```

### Code Analysis

```bash
fos analyze            # Find inefficiencies
fos stats              # Project statistics
fos tree               # Module structure
```

### AI Workflow Commands

```bash
fos read useAuth isAdmin     # Get sed commands to read function bodies
fos read useAuth -c          # Include imports and type context
fos ai                       # Generate AI-friendly overview
fos ai --module src/lib      # AI context for specific module
fos ai --function useAuth    # AI context for specific function
```

## Output Format

Functions are displayed with implicit answers to six questions:

```
[Export] [Async] hasPermission(userId: string; permission: string;)
  src/lib/permissions.ts:6-18
```

This tells you:

- **WHO**: `[Export]` = public function
- **WHAT**: `[Async]` + parameters = async operation with specific inputs
- **WHERE**: `src/lib/permissions.ts:6-18`
- **HOW**: Complexity shown when > 10
- **WHEN**: Use `fos deps` to see relationships
- **WHY**: Inferred from name and type

## AI Agent Workflow

1. **Understand the universe** (30 seconds)

   ```bash
   fos
   ```

2. **Find specific areas** (10 seconds)

   ```bash
   fos find profile
   ```

3. **Understand relationships** (15 seconds)

   ```bash
   fos flow MiniProfile --depth 3
   fos callers useAuth
   ```

4. **Read with context** (30 seconds)

   ```bash
   fos read MiniProfile useAuth -c
   # Copy and run the generated sed commands
   ```

5. **Make intelligent decisions** based on the analysis

## Features

- **faster** than reading files
- **Zero configuration** - works with any TypeScript project
- **AI-optimized** output format
- **Surgical precision** - read only the functions you need
- **Pattern detection** - find inefficiencies automatically

## Philosophy

**Customer Pain → Solution** - NADRAI agents report navigation pains, we eliminate them. No features without proven pain points.

Functions are citizens in a universe. FOS eliminates the cognitive overhead of file navigation, letting AI agents understand codebases through relationships, not hierarchies.

## License

APACHE 2.0
