# Function OS Setup Instructions

## Quick Setup

1. **Navigate to the function-os directory**:

   ```bash
   cd function-os
   ```

2. **Install dependencies** (if not already done):

   ```bash
   npm install
   ```

3. **Build the project**:

   ```bash
   npm run build
   ```

4. **Test locally**:
   ```bash
   npm run dev -- --help
   ```

## Global Installation

To use `fos` command globally:

```bash
# From the function-os directory
npm link

# Now you can use 'fos' from anywhere
fos --help
```

## Publishing to npm

When ready to publish:

1. Update version in package.json
2. Run `npm publish`

## Development

- Source code: `src/cli.ts`
- Build output: `dist/cli.js`
- Run in dev mode: `npm run dev -- [command]`

## Usage Examples

```bash
# List all functions
fos

# Find auth-related functions
fos find auth

# Get function details
fos info useAuth

# Analyze code health
fos analyze

# Generate read commands
fos read useAuth hasPermission
```
