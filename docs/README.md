# Function Operating System (FOS)

A TypeScript analyzer designed for AI-driven development. Analyze TypeScript codebases 25x faster than traditional file reading.

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
fos deps useAuth       # Show dependencies and callers
```

### Code Analysis

```bash
fos analyze            # Find inefficiencies
fos stats              # Project statistics
fos tree               # Module structure
```

### AI Workflow Commands

```bash
fos read useAuth isAdmin  # Get sed commands to read function bodies
fos ai                    # Generate AI-friendly overview
fos ai --module src/lib   # AI context for specific module
fos ai --function useAuth # AI context for specific function
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

3. **Analyze health** (20 seconds)

   ```bash
   fos analyze
   ```

4. **Read only what matters** (1 minute)

   ```bash
   fos read MiniProfile useAuth
   # Copy and run the generated sed commands
   ```

5. **Make intelligent decisions** based on the analysis

## Features

- **25x faster** than reading files
- **Zero configuration** - works with any TypeScript project
- **AI-optimized** output format
- **Surgical precision** - read only the functions you need
- **Pattern detection** - find inefficiencies automatically

## Philosophy

Functions are citizens in a universe. FOS helps you understand this universe and organize it wisely. Instead of drowning in files, you see the big picture and zoom in surgically to what matters.

## License

APACHE 2.0
