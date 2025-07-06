# Function Operating System (FOS)

**Built for AI agents** - Provides raw function data from TypeScript codebases. Treats functions as "citizens in a universe" rather than files in folders.

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
fos                    # Shows LLMs.md help + lists all functions
fos find auth          # Find auth-related functions
fos info useAuth       # Detailed function information
fos deps useAuth       # Show function dependencies
```

## Commands

### List Functions
```bash
fos                    # List all functions (shows LLMs.md first)
fos list               # Same as above
fos voice              # Smart resolution: finds voice.ts
fos src/app            # List functions in specific module
```

### Search Functions
```bash
fos find auth          # Find functions with "auth" in name
fos find "^handle"     # Regex: find all handlers
fos find "^use"        # Regex: find all React hooks
```

### Function Details
```bash
fos info useAuth       # Show complete function details
fos deps useAuth       # Show what function calls
fos callers useAuth    # Show what calls this function
fos type UserProfile   # Show type definition
```

## Output Format

Raw function data for AI processing:

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

## AI Agent Integration

1. **Understand the universe**
   ```bash
   fos
   ```

2. **Find specific areas**
   ```bash
   fos find profile
   ```

3. **Trace dependencies**
   ```bash
   fos deps MiniProfile
   fos callers useAuth
   ```

4. **Get type information**
   ```bash
   fos type UserProfile
   ```

## Features

- **Nested function detection** - finds functions inside objects
- **Smart path resolution** - handles files with/without extensions
- **Raw data output** - no visualizations, just data
- **Module filtering** - analyze specific parts of codebases
- **Zero configuration** - works with any TypeScript project

## Philosophy

Functions are the atomic unit of programming. FOS provides only raw data - AI agents process it. No complex features, no visualizations, just function data.

## License

APACHE 2.0