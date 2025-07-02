# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Function Operating System (FOS)?

FOS is a TypeScript analyzer CLI tool that treats functions as "citizens in a universe" rather than just code in files. It enables AI agents to understand TypeScript codebases 95% faster through surgical precision reading.

## Common Development Commands

### Build and Development
```bash
npm run build          # Build TypeScript to dist/
npm run dev           # Run in development mode with ts-node
```

### Using FOS (after global install: `npm install -g function-os`)
```bash
fos                   # List all functions in the universe
fos find auth         # Find auth-related functions
fos info useAuth      # Detailed function information
fos analyze           # Find code inefficiencies (single-use functions, complexity)
fos read func1 func2  # Generate sed commands to read specific functions
fos deps useAuth      # Show what useAuth depends on
fos tree              # Module structure visualization
fos ai                # AI-friendly codebase overview
```

## Architecture Overview

### Single File Architecture
The entire FOS implementation lives in `src/cli.ts` (854 lines). This follows the project's philosophy of "single module = complete feature" - everything needed to understand and modify FOS is in one place.

### Core Components in cli.ts

1. **TypeScript AST Analysis** (using ts-morph)
   - Function discovery and parsing
   - Complexity calculation
   - Dependency tracking
   - Export detection

2. **Commands Implementation**
   - Each command is a self-contained function
   - Commands follow pattern: parse → analyze → format → output
   - Error propagation without wrapping

3. **Mental Efficiency Patterns**
   - Functions return `undefined` for "not found" (no null)
   - Single choice: `type` over `interface`, `const` over `let`
   - Reality-only state: no defaults, embrace undefined

### Key Design Decisions

1. **Terminal-First**: Solve with terminal commands before writing code
2. **Function-First Features**: New features start as functions, not classes
3. **Motion-Based UI**: Symbols indicate action (→, ←, ↑, ↓, ⟳, ✓, ×)
4. **AI-Optimized Output**: Generates commands for surgical code reading

### Development Workflow

When adding new features:
1. Start with a function in cli.ts
2. Follow existing patterns (look at similar commands)
3. Use TypeScript AST via ts-morph for analysis
4. Output should be AI-friendly (structured, parseable)
5. Errors bubble up immediately - no try/catch wrapping

### Testing
Currently no test infrastructure. The philosophy emphasizes manual testing through actual usage - "reality is the best test."

### Documentation Philosophy
- `/docs/` - User-facing documentation
- `/dev/` - Deep philosophical and architectural insights
- Focus on intention and context over implementation details
- Stories and examples over abstract explanations

## Important Context

This project embodies a unique "Mental Efficiency" philosophy where:
- Functions answer WHO, WHAT, WHERE, WHEN, HOW, WHY implicitly
- Communication happens through "universe bridging"
- Every decision optimizes for cognitive load reduction
- The goal is to make codebases "surgically readable"

When working on FOS, think in terms of helping developers and AI agents understand code faster, not just analyzing it.