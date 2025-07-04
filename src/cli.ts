#!/usr/bin/env node

/**
 * Function Operating System (FOS) - TypeScript Analyzer CLI
 *
 * A standalone CLI tool for analyzing TypeScript codebases.
 * Install globally: npm install -g function-os
 * Use: fos [command] [options]
 */

import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { Node, Project, SourceFile } from 'ts-morph';

// Types
interface FunctionInfo {
  id: string;
  name: string;
  type: 'function' | 'arrow' | 'method' | 'constructor' | 'getter' | 'setter';
  className?: string;
  filePath: string;
  line: number;
  endLine: number;
  size: number;
  async: boolean;
  exported: boolean;
  params: Array<{
    name: string;
    type: string;
    optional: boolean;
    default: string | null;
  }>;
  returnType: string;
  calls: string[];
  complexity: number;
}

// Global state
const functions = new Map<string, FunctionInfo>();
const modules = new Map<string, string[]>();
const typeDefinitions = new Map<string, { filePath: string; line: number; definition: string }>();
let project: Project;

// Initialize the CLI
const program = new Command();

program
  .name('fos')
  .description(`Function Operating System - TypeScript Analyzer for AI Agents

CONTEXT: AI agents need function data from TypeScript codebases.

INTENTION: → Provide function locations and relationships as raw data.

WORKFLOW:

  fos                    # Lists all functions with locations (30 seconds)
  fos find auth          # Filters functions by pattern (10 seconds)
  fos analyze            # Shows function call counts (20 seconds)
  fos read func1 func2   # Generates sed commands for specific functions (1 minute)
  fos deps useAuth       # Shows function dependencies (10 seconds)
  fos info CTASection    # Displays function details (when needed)

DATA PROVIDED:
- Function locations (file:startLine-endLine)
- Export status [Export] or [Internal]
- Function signatures and parameters
- Function calls and dependencies

DATA PROVIDED:
  fos                    # List all functions with locations
  fos find "^use.*"      # Filter functions by regex pattern
  fos info MiniProfile   # Show function details
  fos type BotContext    # Show type definition with location
  fos read MiniProfile   # Generate sed command for function body
  fos analyze            # Show call frequency and dependency groups
  fos deps useAuth       # Show function dependencies
  fos callers useAuth    # Show functions that call this function  
  fos flow useAuth       # Show complete call flow
  fos graph useAuth      # Show dependency graph
  fos read useAuth -c    # Read with imports/context
  fos analyze-repo <url> # Analyze GitHub TypeScript repositories

CONSTRAINTS:
- Requires TypeScript project with tsconfig.json
- Functions must be named (anonymous functions excluded)
- Analyzes .ts and .tsx files only`)
  .version('1.0.0');

// Main list command (default)
program
  .command('list', { isDefault: true })
  .description('List all functions in the codebase')
  .option('-e, --exports', 'Show only exported functions')
  .option('-m, --module <path>', 'Filter by module path')
  .action((options) => {
    analyze();
    cmdList(options);
  });

// Info command
program
  .command('info <function>')
  .description('Show detailed information about a function')
  .action((functionName) => {
    analyze();
    cmdInfo(functionName);
  });

// Find command
program
  .command('find <pattern>')
  .description('Search functions by regex pattern')
  .action((pattern) => {
    analyze();
    cmdFind(pattern);
  });

// Dependencies command
program
  .command('deps <function>')
  .description('Show function dependencies')
  .action((functionName) => {
    analyze();
    cmdDeps(functionName);
  });

// Callers command
program
  .command('callers <function>')
  .description('Show functions that call this function')
  .action((functionName) => {
    analyze();
    cmdCallers(functionName);
  });

// Flow command
program
  .command('flow <function>')
  .description('Show complete call flow from this function')
  .option('-d, --depth <number>', 'Maximum depth to trace', '3')
  .action((functionName, options) => {
    analyze();
    cmdFlow(functionName, options);
  });

// Graph command
program
  .command('graph [function]')
  .description('Show visual dependency graph')
  .option('-f, --format <format>', 'Output format (text|mermaid|dot)', 'text')
  .action((functionName, options) => {
    analyze();
    cmdGraph(functionName, options);
  });

// Tree command
program
  .command('tree')
  .description('Show module tree structure')
  .action(() => {
    analyze();
    cmdTree();
  });

// Stats command
program
  .command('stats')
  .description('Show project statistics')
  .action(() => {
    analyze();
    cmdStats();
  });

// Analyze command
program
  .command('analyze')
  .description('Show function call frequency data')
  .action(() => {
    analyze();
    cmdAnalyze();
  });

// Read command
program
  .command('read <functions...>')
  .description('Generate commands to read specific function bodies')
  .option('-c, --with-context', 'Include imports and type context')
  .action((functionNames, options) => {
    analyze();
    cmdRead(functionNames, options);
  });

// AI command
program
  .command('ai')
  .description('Generate AI-friendly context')
  .option('-m, --module <path>', 'Analyze specific module')
  .option('-f, --function <name>', 'Analyze specific function')
  .action((options) => {
    analyze();
    cmdAI(options);
  });

// Type command
program
  .command('type <typeName>')
  .description('Show type definition')
  .action((typeName) => {
    analyze();
    cmdType(typeName);
  });

// Analyze GitHub repo command
program
  .command('analyze-repo <github-url>')
  .description('Analyze TypeScript functions in a GitHub repository')
  .option('-d, --depth <number>', 'Maximum files to analyze', '100')
  .option('-b, --branch <branch>', 'Branch to analyze', 'main')
  .action((githubUrl, options) => {
    cmdAnalyzeRepo(githubUrl, options);
  });

// Universe command - show complete function graph
program
  .command('universe')
  .description('Show complete function universe as a connected graph for AI agents')
  .option('-e, --entry <function>', 'Start from specific entry point')
  .option('-d, --depth <number>', 'Maximum depth to traverse', '10')
  .action((options) => {
    cmdUniverse(options);
  });


// Analyze the TypeScript project
function analyze() {
  console.log(chalk.gray('Analyzing TypeScript codebase...'));

  // Find tsconfig.json
  const tsConfigPath = findTsConfig();
  if (!tsConfigPath) {
    console.error(chalk.red('Error: No tsconfig.json found in current directory or parent directories'));
    process.exit(1);
  }

  // Initialize project
  project = new Project({
    tsConfigFilePath: tsConfigPath
  });

  // Clear previous data
  functions.clear();
  modules.clear();
  typeDefinitions.clear();

  // Analyze all source files
  const sourceFiles = project.getSourceFiles();

  sourceFiles.forEach(sourceFile => {
    const filePath = sourceFile.getFilePath();

    // Skip node_modules and build directories
    if (filePath.includes('node_modules') || filePath.includes('.next') || filePath.includes('dist')) {
      return;
    }

    const relativePath = path.relative(process.cwd(), filePath);
    const modulePath = path.dirname(relativePath);

    // Extract functions
    const extracted = extractFunctions(sourceFile, relativePath);

    // Extract type definitions
    extractTypeDefinitions(sourceFile, relativePath);

    // Store in registry
    extracted.forEach(func => {
      functions.set(func.id, func);

      if (!modules.has(modulePath)) {
        modules.set(modulePath, []);
      }
      modules.get(modulePath)!.push(func.id);
    });
  });
}

// Find tsconfig.json
function findTsConfig(): string | null {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const tsConfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      return tsConfigPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

// Extract all functions from a source file
function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionInfo[] {
  const results: FunctionInfo[] = [];

  // Regular functions
  sourceFile.getFunctions().forEach(func => {
    results.push(extractFunctionData(func, filePath, 'function'));
  });

  // Arrow functions and function expressions
  sourceFile.getVariableDeclarations().forEach(variable => {
    const init = variable.getInitializer();
    if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
      results.push(extractFunctionData(variable, filePath, 'arrow', init));
    }
  });

  // Class methods
  sourceFile.getClasses().forEach(classDecl => {
    // Constructors
    classDecl.getConstructors().forEach(constructor => {
      results.push(extractFunctionData(constructor, filePath, 'constructor', null, classDecl.getName()));
    });

    // Methods
    classDecl.getMethods().forEach(method => {
      results.push(extractFunctionData(method, filePath, 'method', null, classDecl.getName()));
    });

    // Getters
    classDecl.getGetAccessors().forEach(getter => {
      results.push(extractFunctionData(getter, filePath, 'getter', null, classDecl.getName()));
    });

    // Setters
    classDecl.getSetAccessors().forEach(setter => {
      results.push(extractFunctionData(setter, filePath, 'setter', null, classDecl.getName()));
    });
  });

  return results;
}

// Extract type definitions from a source file
function extractTypeDefinitions(sourceFile: SourceFile, filePath: string): void {
  // Extract interfaces
  sourceFile.getInterfaces().forEach(interfaceDecl => {
    const name = interfaceDecl.getName();
    typeDefinitions.set(name, {
      filePath,
      line: interfaceDecl.getStartLineNumber(),
      definition: interfaceDecl.getText()
    });
  });

  // Extract type aliases
  sourceFile.getTypeAliases().forEach(typeAlias => {
    const name = typeAlias.getName();
    typeDefinitions.set(name, {
      filePath,
      line: typeAlias.getStartLineNumber(),
      definition: typeAlias.getText()
    });
  });

  // Extract enums
  sourceFile.getEnums().forEach(enumDecl => {
    const name = enumDecl.getName();
    typeDefinitions.set(name, {
      filePath,
      line: enumDecl.getStartLineNumber(),
      definition: enumDecl.getText()
    });
  });
}

// Extract detailed function data
function extractFunctionData(
  node: any,
  filePath: string,
  type: string,
  arrowFunc: any = null,
  className: string | null = null
): FunctionInfo {
  const name = node.getName ? node.getName() : 'anonymous';
  const funcNode = arrowFunc || node;

  // Extract parameters with types
  const params: FunctionInfo['params'] = [];
  if (funcNode.getParameters) {
    funcNode.getParameters().forEach((param: any) => {
      params.push({
        name: param.getName(),
        type: cleanType(param.getType().getText()),
        optional: param.isOptional(),
        default: param.hasInitializer() ? param.getInitializer()?.getText() || null : null
      });
    });
  }

  // Extract return type
  const returnType = funcNode.getReturnType ? cleanType(funcNode.getReturnType().getText()) : 'void';

  // Extract function calls
  const calls = extractCalls(funcNode);

  // Calculate complexity (simple metric: number of calls + number of lines / 10)
  const complexity = calls.length + Math.floor((node.getEndLineNumber() - node.getStartLineNumber()) / 10);

  return {
    id: className ? `${filePath}:${className}.${name}` : `${filePath}:${name}`,
    name,
    type: type as any,
    className: className || undefined,
    filePath,
    line: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    size: node.getEndLineNumber() - node.getStartLineNumber() + 1,
    async: funcNode.isAsync ? funcNode.isAsync() : false,
    exported: node.isExported ? node.isExported() : false,
    params,
    returnType,
    calls,
    complexity,
  };
}

// Clean up type strings
function cleanType(typeStr: string): string {
  typeStr = typeStr.replace(/import\([^)]+\)\./g, '');
  typeStr = typeStr.replace(/React\.FC<(.+)>/, 'FC<$1>');
  typeStr = typeStr.replace(/React\.ReactElement/, 'ReactElement');
  typeStr = typeStr.replace(/React\.ReactNode/, 'ReactNode');

  if (typeStr.length > 100) {
    return typeStr.substring(0, 97) + '...';
  }

  return typeStr;
}

// Extract function calls
function extractCalls(node: any): string[] {
  const calls = new Set<string>();
  const body = node.getBody ? node.getBody() : node;

  if (body && body.forEachDescendant) {
    body.forEachDescendant((child: any) => {
      if (Node.isCallExpression(child)) {
        const expr = child.getExpression();

        // Handle dynamic imports: import('./module')
        if (expr.getText() === 'import') {
          const args = child.getArguments();
          if (args.length > 0) {
            const importPath = args[0].getText().replace(/['"]/g, '');
            calls.add(`import(${importPath})`);
          }
        } else if (Node.isIdentifier(expr)) {
          calls.add(expr.getText());
        } else if (Node.isPropertyAccessExpression(expr)) {
          const obj = expr.getExpression();
          const prop = expr.getName();
          if (Node.isIdentifier(obj)) {
            calls.add(`${obj.getText()}.${prop}`);
          }
        }
      }
    });
  }

  return Array.from(calls);
}




// Command: List all functions
function cmdList(options: any) {
  console.log(chalk.bold('\nTypeScript Functions\n'));

  let filtered = Array.from(functions.values());

  // Apply filters
  if (options.exports) {
    filtered = filtered.filter(f => f.exported);
  }
  if (options.module) {
    filtered = filtered.filter(f => f.filePath.includes(options.module));
  }

  // Group by module
  const grouped = new Map<string, FunctionInfo[]>();
  filtered.forEach(func => {
    const moduleDir = path.dirname(func.filePath);
    if (!grouped.has(moduleDir)) grouped.set(moduleDir, []);
    grouped.get(moduleDir)!.push(func);
  });

  // Display
  grouped.forEach((funcs, module) => {
    console.log(chalk.yellow(`\n${module}`));
    console.log(chalk.gray('-'.repeat(50)));

    funcs.forEach(func => {
      const exp = func.exported ? '[Export]' : '[Internal]';
      const paramDisplay = formatParams(func.params, true);

      console.log(`${exp} ${chalk.cyan(func.name)}(${paramDisplay})`);
      console.log(chalk.gray(`  ${func.filePath}:${func.line}-${func.endLine}`));
    });
  });

  console.log(chalk.bold(`\nTotal: ${filtered.length} functions`));
  
  // AI Agent Help
  console.log(chalk.gray('\n' + '='.repeat(60)));
  console.log(chalk.yellow('AI AGENT WORKFLOW GUIDE'));
  console.log(chalk.gray('='.repeat(60)));
  console.log('→ Find patterns: ' + chalk.cyan('fos find auth'));
  console.log('→ Understand relationships: ' + chalk.cyan('fos flow <function>'));
  console.log('→ See callers: ' + chalk.cyan('fos callers <function>'));
  console.log('→ Read with context: ' + chalk.cyan('fos read <function> -c'));
  console.log('→ Visualize dependencies: ' + chalk.cyan('fos graph <function>'));
  console.log('→ Analyze remote repos: ' + chalk.cyan('fos analyze-repo <github-url>'));
  console.log(chalk.gray('Run specific commands above instead of exploring randomly.'));
}

// Command: Show function info
function cmdInfo(funcName: string) {
  const func = Array.from(functions.values()).find(f =>
    f.name === funcName || f.id.endsWith(`:${funcName}`)
  );

  if (!func) {
    console.log(chalk.red(`Function "${funcName}" not found`));
    return;
  }

  console.log(chalk.bold(`\nFunction: ${func.name}`));
  console.log('='.repeat(50));

  const callers = findCallers(func.name);

  console.log(`Type: ${func.exported ? 'Exported' : 'Internal'} ${func.async ? 'Async' : ''} ${func.type}`);
  console.log(`Location: ${func.filePath}:${func.line}-${func.endLine} (${func.size} lines)`);

  if (func.params.length > 0) {
    console.log('\nParameters:');
    func.params.forEach(p => {
      const opt = p.optional ? ' (optional)' : '';
      const def = p.default ? ` = ${p.default}` : '';
      console.log(`  ${p.name}: ${p.type}${opt}${def}`);
    });
  }

  console.log(`\nReturns: ${formatType(func.returnType)}`);

  if (func.calls.length > 0) {
    console.log('\nCalls:');
    func.calls.slice(0, 10).forEach(call => {
      console.log(`  - ${call}`);
    });
    if (func.calls.length > 10) {
      console.log(`  ... and ${func.calls.length - 10} more`);
    }
  }

  if (callers.length > 0) {
    console.log('\nCalled by:');
    callers.forEach(caller => {
      console.log(`  - ${caller.name} (${path.basename(caller.filePath)})`);
    });
  } else if (func.exported) {
    console.log('\nCalled by: External consumers (exported function)');
  } else {
    console.log('\nCalled by: None (potential dead code)');
  }

  const link = `file://${path.resolve(func.filePath)}:${func.line}:1`;
  console.log(chalk.blue(`\nDirect Access: ${chalk.underline(link)}`));
}

// Command: Find functions
function cmdFind(pattern: string) {
  // Filter functions globally before displaying
  const originalFunctions = new Map(functions);
  functions.clear();

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'i'); // Case insensitive
  } catch (e) {
    // Fallback to simple string match if regex is invalid
    console.log(chalk.yellow(`Invalid regex, using string match: ${pattern}`));
    originalFunctions.forEach((func, id) => {
      if (func.name.toLowerCase().includes(pattern.toLowerCase())) {
        functions.set(id, func);
      }
    });
    cmdList({ exports: false, module: null });
    functions.clear();
    originalFunctions.forEach((func, id) => {
      functions.set(id, func);
    });
    return;
  }

  originalFunctions.forEach((func, id) => {
    if (regex.test(func.name)) {
      functions.set(id, func);
    }
  });

  // Display filtered results
  cmdList({ exports: false, module: null });

  // Restore original functions
  functions.clear();
  originalFunctions.forEach((func, id) => {
    functions.set(id, func);
  });
}

// Command: Show dependencies
function cmdDeps(funcName: string) {
  const func = Array.from(functions.values()).find(f =>
    f.name === funcName || f.id.endsWith(`:${funcName}`)
  );

  if (!func) {
    console.log(chalk.red(`Function "${funcName}" not found`));
    return;
  }

  console.log(chalk.bold(`\nDependencies: ${func.name}`));
  console.log('='.repeat(50));

  console.log('\nCalls:');
  const projectCalls = func.calls.filter(call => 
    Array.from(functions.values()).find(f => f.name === call)
  );
  if (projectCalls.length === 0) {
    console.log('  (none)');
  } else {
    projectCalls.forEach(call => {
      const calledFunc = Array.from(functions.values()).find(f => f.name === call);
      if (calledFunc) {
        console.log(`  - ${call} (${path.basename(calledFunc.filePath)}:${calledFunc.line})`);
      }
    });
  }

  const callers = findCallers(func.name);
  console.log('\nCalled by:');
  if (callers.length === 0) {
    console.log('  (none)');
  } else {
    callers.forEach(caller => {
      console.log(`  - ${caller.name} (${path.basename(caller.filePath)}:${caller.line})`);
    });
  }
}

// Command: Show tree
function cmdTree() {
  console.log(chalk.bold('\nModule Tree'));
  console.log('='.repeat(50));

  const tree = new Map<string, any>();

  modules.forEach((funcIds, modulePath) => {
    const parts = modulePath.split(path.sep);
    let current = tree;

    parts.forEach((part, i) => {
      if (!current.has(part)) {
        current.set(part, { funcs: [], children: new Map() });
      }
      if (i === parts.length - 1) {
        current.get(part).funcs = funcIds;
      }
      current = current.get(part).children;
    });
  });

  function displayTree(node: Map<string, any>, indent = '') {
    node.forEach((value, key) => {
      const funcCount = value.funcs.length;
      console.log(`${indent}[${key}] (${funcCount} functions)`);
      if (value.children.size > 0) {
        displayTree(value.children, indent + '  ');
      }
    });
  }

  displayTree(tree);
  console.log(chalk.bold(`\nTotal: ${functions.size} functions in ${modules.size} modules`));
}

// Command: Show stats
function cmdStats() {
  console.log(chalk.bold('\nProject Statistics'));
  console.log('='.repeat(50));

  const stats = {
    total: functions.size,
    components: 0,
    hooks: 0,
    async: 0,
    exported: 0,
    totalSize: 0
  };

  let largest: FunctionInfo | null = null;
  const callCounts = new Map<string, number>();

  functions.forEach(func => {
    if (func.name.startsWith('use')) stats.hooks++;
    if (func.async) stats.async++;
    if (func.exported) stats.exported++;

    stats.totalSize += func.size;

    if (!largest || func.size > largest.size) largest = func;

    func.calls.forEach(call => {
      callCounts.set(call, (callCounts.get(call) || 0) + 1);
    });
  });

  console.log(`Total Functions: ${stats.total}`);
  console.log(`React Hooks: ${stats.hooks}`);
  console.log(`Async Functions: ${stats.async}`);
  console.log(`Exported: ${stats.exported}`);
  console.log(`\nAverage Size: ${Math.round(stats.totalSize / stats.total)} lines`);

  if (largest) {
    console.log(`\nLargest: ${(largest as FunctionInfo).name} (${(largest as FunctionInfo).size} lines)`);
  }

  console.log('\nMost Called:');
  Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count} times`);
    });
}

// Command: Show function call frequency
function cmdAnalyze() {
  console.log(chalk.bold('\nFunction Call Frequency'));
  console.log('='.repeat(50));

  // Count function calls
  const callCounts = new Map<string, number>();
  functions.forEach(func => {
    func.calls.forEach(call => {
      const calledFunc = Array.from(functions.values()).find(f => f.name === call);
      if (calledFunc) {
        const count = callCounts.get(calledFunc.name) || 0;
        callCounts.set(calledFunc.name, count + 1);
      }
    });
  });

  // Call frequency data
  console.log('\nCall Frequency:');
  const sortedCalls = Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  sortedCalls.forEach(([name, count]) => {
    const func = Array.from(functions.values()).find(f => f.name === name);
    if (func) {
      console.log(`${name}: ${count} calls`);
    }
  });

  // Show raw connection data
  console.log('\nFunction Connections:');
  console.log('='.repeat(50));

  // Build adjacency list
  const graph = new Map<string, Set<string>>();
  const reverseGraph = new Map<string, Set<string>>();

  // Initialize graph nodes
  functions.forEach(func => {
    graph.set(func.name, new Set());
    reverseGraph.set(func.name, new Set());
  });

  // Build edges
  functions.forEach(func => {
    func.calls.forEach(calledName => {
      const calledFunc = Array.from(functions.values()).find(f => f.name === calledName);
      if (calledFunc) {
        graph.get(func.name)!.add(calledFunc.name);
        reverseGraph.get(calledFunc.name)!.add(func.name);
      }
    });
  });

  // Find connected components using DFS
  const visited = new Set<string>();
  const components: string[][] = [];

  function dfs(node: string, component: string[]) {
    if (visited.has(node)) return;
    visited.add(node);
    component.push(node);

    // Visit nodes this function calls
    graph.get(node)?.forEach(child => dfs(child, component));
    // Visit nodes that call this function
    reverseGraph.get(node)?.forEach(parent => dfs(parent, component));
  }

  // Find all connected components
  functions.forEach(func => {
    if (!visited.has(func.name)) {
      const component: string[] = [];
      dfs(func.name, component);
      if (component.length > 1) { // Only show connected components
        components.push(component);
      }
    }
  });

  // Sort components by size
  components.sort((a, b) => b.length - a.length);

  console.log(`\nConnected Components: ${components.length}`);

  // Display each component
  components.forEach((component, idx) => {
    console.log(`\n${chalk.yellow(`Group ${idx + 1}`)} (${component.length} functions):`);

    // Count total edges in this component
    let edgeCount = 0;
    component.forEach(funcName => {
      edgeCount += graph.get(funcName)?.size || 0;
    });

    console.log(`Total relationships: ${edgeCount}`);

    // Show the functions and their connections
    component.slice(0, 10).forEach(funcName => {
      const calls = Array.from(graph.get(funcName) || []).filter(n => component.includes(n));
      const calledBy = Array.from(reverseGraph.get(funcName) || []).filter(n => component.includes(n));

      console.log(`  ${chalk.cyan(funcName)}`);
      if (calls.length > 0) {
        console.log(`    → calls: ${calls.join(', ')}`);
      }
      if (calledBy.length > 0) {
        console.log(`    ← called by: ${calledBy.join(', ')}`);
      }
    });

    if (component.length > 10) {
      console.log(`  ... and ${component.length - 10} more functions`);
    }
  });

  // Show isolated functions count
  const isolatedCount = functions.size - visited.size;
  if (isolatedCount > 0) {
    console.log(`\n${chalk.gray(`${isolatedCount} isolated functions (no dependencies)`)}`)
  }
}

// Command: Generate read commands
function cmdRead(functionNames: string[], options?: any) {
  const funcsToRead: FunctionInfo[] = [];

  functionNames.forEach(name => {
    const func = Array.from(functions.values()).find(f =>
      f.name === name || f.id.endsWith(`:${name}`)
    );
    if (func) {
      funcsToRead.push(func);
    } else {
      console.log(chalk.red(`Function "${name}" not found`));
    }
  });

  if (funcsToRead.length === 0) return;

  console.log(chalk.bold('\nFunction Read Commands:'));
  console.log('='.repeat(50));
  
  if (options?.withContext) {
    console.log('Reading functions with import context:\n');
    
    funcsToRead.forEach(func => {
      console.log(chalk.gray(`# ${func.name} with imports`));
      console.log(`echo "=== ${func.name} imports ===" && head -20 ${func.filePath} | grep -E "^import|^export" && echo && echo "=== ${func.name} function ===" && sed -n '${func.line},${func.endLine}p' ${func.filePath}`);
      console.log();
    });
  } else {
    console.log('Run these commands in parallel to read function bodies:\n');

    funcsToRead.forEach(func => {
      console.log(chalk.gray(`# ${func.name}`));
      console.log(`sed -n '${func.line},${func.endLine}p' ${func.filePath}`);
      console.log();
    });
  }

  console.log('Or read all at once:');
  const combined = funcsToRead.map(f =>
    options?.withContext 
      ? `echo "=== ${f.name} ===" && head -20 ${f.filePath} | grep -E "^import|^export" && echo && sed -n '${f.line},${f.endLine}p' ${f.filePath}`
      : `echo "=== ${f.name} ===" && sed -n '${f.line},${f.endLine}p' ${f.filePath}`
  ).join(' && echo && ');
  console.log(combined);
}

// Command: AI context
function cmdAI(options: any) {
  if (options.module) {
    const moduleFuncs = Array.from(functions.values())
      .filter(f => f.filePath.includes(options.module));

    console.log(chalk.bold(`# Module: ${options.module}\n`));
    console.log(`Functions: ${moduleFuncs.length}\n`);

    console.log('## Exported API');
    moduleFuncs.filter(f => f.exported).forEach(f => {
      console.log(`- **${f.name}**(${formatParams(f.params, true)}) → ${formatType(f.returnType)}`);
    });

    console.log('\n## Internal');
    moduleFuncs.filter(f => !f.exported).forEach(f => {
      console.log(`- ${f.name}()`);
    });
  } else if (options.function) {
    const func = Array.from(functions.values()).find(f =>
      f.name === options.function || f.id.endsWith(`:${options.function}`)
    );

    if (!func) {
      console.log(chalk.red(`Function "${options.function}" not found`));
      return;
    }

    console.log(chalk.bold(`# Function: ${func.name}\n`));
    console.log(`**Location**: ${func.filePath}:${func.line}`);
    console.log(`**Signature**: ${func.name}(${formatParams(func.params, true)}) → ${formatType(func.returnType)}`);

    if (func.calls.length > 0) {
      console.log(`\n**Dependencies**: ${func.calls.join(', ')}`);
    }
  } else {
    console.log(chalk.bold('# Function Overview\n'));
    console.log(`Total: ${functions.size} functions\n`);

    // List functions by module
    console.log('## Functions by Module\n');
    modules.forEach((funcIds, modulePath) => {
      console.log(`### ${modulePath}`);
      funcIds.slice(0, 10).forEach(id => {
        const func = functions.get(id);
        if (func) {
          console.log(`- ${func.name}()`);
        }
      });
      if (funcIds.length > 10) {
        console.log(`- ... and ${funcIds.length - 10} more`);
      }
      console.log();
    });
  }
}

// Command: Show type definition
function cmdType(typeName: string) {
  const typeDef = typeDefinitions.get(typeName);
  
  if (!typeDef) {
    console.log(chalk.red(`Type "${typeName}" not found`));
    return;
  }
  
  console.log(chalk.bold(`\nType: ${typeName}`));
  console.log('='.repeat(50));
  console.log(`Location: ${typeDef.filePath}:${typeDef.line}`);
  console.log(`Definition: ${typeDef.definition}`);
  
  const link = `file://${path.resolve(typeDef.filePath)}:${typeDef.line}:1`;
  console.log(chalk.blue(`\nDirect Access: ${chalk.underline(link)}`));
}

// Helper: Format type with clickable links
function formatType(type: string): string {
  return type;
}

// Helper: Format parameters
function formatParams(params: FunctionInfo['params'], withTypes = false): string {
  if (params.length === 0) return '';

  // For destructured object parameters
  if (params.length === 1 && params[0].name.includes('{')) {
    const param = params[0];
    if (withTypes) {
      const typeMatch = param.type.match(/(\w+Props|\w+)$/);
      const typeName = typeMatch ? typeMatch[1] : param.type;
      return typeName;
    }
    return params[0].name;
  }

  return params.map(p => {
    if (withTypes) {
      if (p.name === 'params' && p.type.includes('{')) {
        const typeContent = p.type.replace(/^{\s*|\s*}$/g, '').trim();
        return typeContent;
      }
      return `${p.name}: ${formatType(p.type)}${p.optional ? '?' : ''}`;
    }
    return p.name;
  }).join(', ');
}

// Helper: Find callers
function findCallers(funcName: string): FunctionInfo[] {
  const callers: FunctionInfo[] = [];
  functions.forEach(func => {
    if (func.calls.includes(funcName)) {
      callers.push(func);
    }
  });
  return callers;
}

// Command: Show callers only
function cmdCallers(funcName: string) {
  const func = Array.from(functions.values()).find(f =>
    f.name === funcName || f.id.endsWith(`:${funcName}`)
  );

  if (!func) {
    console.log(chalk.red(`Function "${funcName}" not found`));
    return;
  }

  const callers = findCallers(func.name);
  console.log(chalk.bold(`\nFunctions calling: ${func.name}`));
  console.log('='.repeat(50));

  if (callers.length === 0) {
    console.log('  (none)');
  } else {
    callers.forEach(caller => {
      console.log(`  → ${caller.name} (${path.basename(caller.filePath)}:${caller.line})`);
    });
  }
}

// Command: Show complete call flow
function cmdFlow(funcName: string, options: any) {
  const func = Array.from(functions.values()).find(f =>
    f.name === funcName || f.id.endsWith(`:${funcName}`)
  );

  if (!func) {
    console.log(chalk.red(`Function "${funcName}" not found`));
    return;
  }

  const depth = parseInt(options.depth || '3');
  console.log(chalk.bold(`\nCall Flow: ${func.name}`));
  console.log('='.repeat(50));

  function traceFlow(currentFunc: FunctionInfo, currentDepth: number, visited: Set<string>, prefix: string = '') {
    if (currentDepth > depth || visited.has(currentFunc.name)) {
      if (visited.has(currentFunc.name)) {
        console.log(`${prefix}⟳ ${currentFunc.name} (circular)`);
      }
      return;
    }

    visited.add(currentFunc.name);
    console.log(`${prefix}${currentFunc.name} (${path.basename(currentFunc.filePath)}:${currentFunc.line})`);

    const projectCalls = currentFunc.calls.filter(call => 
      Array.from(functions.values()).find(f => f.name === call)
    );
    
    projectCalls.forEach((call, index) => {
      const calledFunc = Array.from(functions.values()).find(f => f.name === call);
      const isLast = index === projectCalls.length - 1;
      const newPrefix = prefix + (isLast ? '  ' : '│ ');
      const connector = isLast ? '└→' : '├→';
      
      if (calledFunc) {
        console.log(`${prefix}${connector} ${call}`);
        traceFlow(calledFunc, currentDepth + 1, new Set(visited), newPrefix);
      }
    });
  }

  traceFlow(func, 0, new Set());
}

// Command: Show dependency graph
function cmdGraph(funcName?: string, options?: any) {
  const format = options?.format || 'text';
  
  if (format === 'mermaid') {
    generateMermaidGraph(funcName);
  } else if (format === 'dot') {
    generateDotGraph(funcName);
  } else {
    generateTextGraph(funcName);
  }
}

function generateTextGraph(funcName?: string) {
  console.log(chalk.bold('\nFunction Dependency Graph'));
  console.log('='.repeat(50));

  const functionsToShow = funcName 
    ? [Array.from(functions.values()).find(f => f.name === funcName || f.id.endsWith(`:${funcName}`))].filter(Boolean)
    : Array.from(functions.values());

  if (functionsToShow.length === 0) {
    console.log(chalk.red(`Function "${funcName}" not found`));
    return;
  }

  functionsToShow.forEach(func => {
    if (!func) return;
    
    console.log(`\n${chalk.cyan(func.name)} (${path.basename(func.filePath)}:${func.line})`);
    
    // Show what this function calls (project functions only)
    const projectCalls = func.calls.filter(call => 
      Array.from(functions.values()).find(f => f.name === call)
    );
    if (projectCalls.length > 0) {
      console.log('  → Calls:');
      projectCalls.forEach(call => {
        const calledFunc = Array.from(functions.values()).find(f => f.name === call);
        if (calledFunc) {
          console.log(`    ├─ ${call} (${path.basename(calledFunc.filePath)}:${calledFunc.line})`);
        }
      });
    }
    
    // Show what calls this function
    const callers = findCallers(func.name);
    if (callers.length > 0) {
      console.log('  ← Called by:');
      callers.forEach(caller => {
        console.log(`    ├─ ${caller.name} (${path.basename(caller.filePath)}:${caller.line})`);
      });
    }
  });
}

function generateMermaidGraph(funcName?: string) {
  console.log('```mermaid');
  console.log('graph TD');
  
  const functionsToShow = funcName 
    ? [Array.from(functions.values()).find(f => f.name === funcName || f.id.endsWith(`:${funcName}`))].filter(Boolean)
    : Array.from(functions.values());

  if (functionsToShow.length === 0) {
    console.log('  %% Function not found');
    console.log('```');
    return;
  }

  // Generate unique IDs for mermaid
  const nodeIds = new Map<string, string>();
  let nodeCounter = 0;
  
  function getNodeId(funcName: string): string {
    if (!nodeIds.has(funcName)) {
      nodeIds.set(funcName, `F${nodeCounter++}`);
    }
    return nodeIds.get(funcName)!;
  }

  functionsToShow.forEach(func => {
    if (!func) return;
    
    const funcId = getNodeId(func.name);
    console.log(`  ${funcId}["${func.name}"]`);
    
    const projectCalls = func.calls.filter(call => 
      Array.from(functions.values()).find(f => f.name === call)
    );
    
    projectCalls.forEach(call => {
      const callId = getNodeId(call);
      console.log(`  ${callId}["${call}"]`);
      console.log(`  ${funcId} --> ${callId}`);
    });
  });
  
  console.log('```');
}

function generateDotGraph(funcName?: string) {
  console.log('digraph FunctionDependencies {');
  console.log('  rankdir=TB;');
  console.log('  node [shape=box];');
  
  const functionsToShow = funcName 
    ? [Array.from(functions.values()).find(f => f.name === funcName || f.id.endsWith(`:${funcName}`))].filter(Boolean)
    : Array.from(functions.values());

  if (functionsToShow.length === 0) {
    console.log('  // Function not found');
    console.log('}');
    return;
  }

  functionsToShow.forEach(func => {
    if (!func) return;
    
    const projectCalls = func.calls.filter(call => 
      Array.from(functions.values()).find(f => f.name === call)
    );
    
    projectCalls.forEach(call => {
      console.log(`  "${func.name}" -> "${call}";`);
    });
  });
  
  console.log('}');
}

// Command: Show complete function universe as connected graph (raw data only)
function cmdUniverse(options: any) {
  analyze();
  
  const allFunctions = Array.from(functions.values());
  
  if (allFunctions.length === 0) {
    console.log(chalk.yellow('No functions found in the codebase.'));
    return;
  }

  console.log(chalk.cyan('\n=== FUNCTION UNIVERSE ===\n'));

  // Show all functions with their raw relationships
  console.log(chalk.yellow('All Functions:\n'));
  
  allFunctions.forEach(func => {
    console.log(`${func.name}:`);
    console.log(`  type: ${func.type}`);
    console.log(`  async: ${func.async}`);
    console.log(`  exported: ${func.exported}`);
    console.log(`  location: ${func.filePath}:${func.line}-${func.endLine}`);
    
    if (func.params.length > 0) {
      console.log(`  params:`);
      func.params.forEach(param => {
        console.log(`    - ${param.name}: ${param.type}${param.optional ? '?' : ''}${param.default ? ` = ${param.default}` : ''}`);
      });
    }
    
    if (func.returnType) {
      console.log(`  returns: ${func.returnType}`);
    }
    
    if (func.calls.length > 0) {
      console.log(`  calls:`);
      func.calls.forEach(call => {
        console.log(`    → ${call}`);
      });
    }
    
    console.log(`  complexity: ${func.complexity}`);
    console.log();
  });

  // Show function call graph
  console.log(chalk.yellow('Function Call Graph:\n'));
  
  allFunctions.forEach(func => {
    if (func.calls.length > 0) {
      func.calls.forEach(calledFunc => {
        console.log(`${func.name} → ${calledFunc}`);
      });
    }
  });

  // Show who calls whom (reverse dependencies)
  console.log(chalk.yellow('\nCalled By Graph:\n'));
  
  const calledByMap = new Map<string, string[]>();
  
  allFunctions.forEach(func => {
    func.calls.forEach(calledFunc => {
      if (!calledByMap.has(calledFunc)) {
        calledByMap.set(calledFunc, []);
      }
      calledByMap.get(calledFunc)!.push(func.name);
    });
  });
  
  calledByMap.forEach((callers, funcName) => {
    console.log(`${funcName} ← ${callers.join(', ')}`);
  });

  // Show functions that don't call anyone
  console.log(chalk.yellow('\nLeaf Functions (no calls):\n'));
  const leafFunctions = allFunctions.filter(f => f.calls.length === 0);
  leafFunctions.forEach(func => {
    console.log(`- ${func.name}`);
  });

  // Show functions that aren't called by anyone
  console.log(chalk.yellow('\nRoot Functions (not called):\n'));
  const rootFunctions = allFunctions.filter(func => 
    !allFunctions.some(f => f.calls.includes(func.name))
  );
  rootFunctions.forEach(func => {
    console.log(`- ${func.name}`);
  });

  // Show async call chains
  console.log(chalk.yellow('\nAsync Functions:\n'));
  const asyncFunctions = allFunctions.filter(f => f.async);
  asyncFunctions.forEach(func => {
    console.log(`- ${func.name}${func.calls.length > 0 ? ` → ${func.calls.join(', ')}` : ''}`);
  });

  // Show exported vs internal
  console.log(chalk.yellow('\nExported Functions:\n'));
  const exportedFunctions = allFunctions.filter(f => f.exported);
  exportedFunctions.forEach(func => {
    console.log(`- ${func.name}`);
  });

  console.log(chalk.yellow('\nInternal Functions:\n'));
  const internalFunctions = allFunctions.filter(f => !f.exported);
  internalFunctions.forEach(func => {
    console.log(`- ${func.name}`);
  });
}


// Command: Analyze GitHub repository
async function cmdAnalyzeRepo(githubUrl: string, options: any) {
  console.log(chalk.bold(`\nAnalyzing GitHub Repository: ${githubUrl}`));
  console.log('='.repeat(70));
  
  try {
    // Parse GitHub URL
    const repoInfo = parseGitHubUrl(githubUrl);
    if (!repoInfo) {
      console.log(chalk.red('Invalid GitHub URL format. Use: https://github.com/owner/repo'));
      return;
    }
    
    const { owner, repo } = repoInfo;
    const branch = options.branch || 'main';
    const maxFiles = parseInt(options.depth || '100');
    
    console.log(chalk.gray(`Repository: ${owner}/${repo}`));
    console.log(chalk.gray(`Branch: ${branch}`));
    console.log(chalk.gray(`Max files: ${maxFiles}`));
    console.log('');
    
    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), `fos-${owner}-${repo}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    console.log(chalk.yellow('→ Fetching TypeScript files from GitHub...'));
    
    // Fetch repository structure
    const files = await fetchRepoFiles(owner, repo, branch, maxFiles);
    
    if (files.length === 0) {
      console.log(chalk.red('No TypeScript files found in repository'));
      cleanup(tempDir);
      return;
    }
    
    console.log(chalk.gray(`Found ${files.length} TypeScript files`));
    
    // Create temporary project structure
    console.log(chalk.yellow('→ Creating temporary project...'));
    await createTempProject(tempDir, files);
    
    // Create minimal tsconfig.json
    const tsConfigPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(tsConfigPath, JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        strict: false,
        skipLibCheck: true
      },
      include: ["**/*.ts", "**/*.tsx"]
    }, null, 2));
    
    // Analyze the temporary project
    console.log(chalk.yellow('→ Running FOS analysis...'));
    const originalCwd = process.cwd();
    
    try {
      process.chdir(tempDir);
      
      // Initialize project for analysis
      const tempProject = new Project({
        tsConfigFilePath: tsConfigPath
      });
      
      // Clear previous data and analyze
      functions.clear();
      modules.clear();
      typeDefinitions.clear();
      
      const sourceFiles = tempProject.getSourceFiles();
      let totalFunctions = 0;
      
      sourceFiles.forEach(sourceFile => {
        const filePath = sourceFile.getFilePath();
        const relativePath = path.relative(tempDir, filePath);
        
        const extracted = extractFunctions(sourceFile, relativePath);
        totalFunctions += extracted.length;
        
        extracted.forEach(func => {
          functions.set(func.id, func);
        });
        
        extractTypeDefinitions(sourceFile, relativePath);
      });
      
      // Show results
      console.log(chalk.green('\\n✓ Analysis complete!'));
      console.log(chalk.bold(`\\nRepository Analysis: ${owner}/${repo}`));
      console.log('='.repeat(50));
      console.log(`Total TypeScript files: ${sourceFiles.length}`);
      console.log(`Total functions found: ${totalFunctions}`);
      console.log(`Total types found: ${typeDefinitions.size}`);
      
      // Show top-level structure
      const moduleGroups = new Map<string, number>();
      functions.forEach(func => {
        const moduleDir = path.dirname(func.filePath);
        const topLevel = moduleDir.split('/')[0] || '.';
        moduleGroups.set(topLevel, (moduleGroups.get(topLevel) || 0) + 1);
      });
      
      console.log('\\nFunction distribution:');
      Array.from(moduleGroups.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([module, count]) => {
          console.log(`  ${chalk.cyan(module)}: ${count} functions`);
        });
      
      // Show most complex functions
      const complexFunctions = Array.from(functions.values())
        .filter(f => f.complexity > 5)
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 5);
      
      if (complexFunctions.length > 0) {
        console.log('\\nMost complex functions:');
        complexFunctions.forEach(func => {
          console.log(`  ${chalk.yellow(func.name)} (complexity: ${func.complexity}) - ${func.filePath}`);
        });
      }
      
      // Show exported functions
      const exportedFunctions = Array.from(functions.values()).filter(f => f.exported);
      console.log(`\\nExported functions: ${exportedFunctions.length}`);
      
      console.log(chalk.gray('\\nUse regular fos commands to explore further in this temporary workspace.'));
      console.log(chalk.gray(`Temp directory: ${tempDir}`));
      
    } finally {
      process.chdir(originalCwd);
    }
    
  } catch (error) {
    console.log(chalk.red(`Error analyzing repository: ${error}`));
  }
}

// Helper: Parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  
  return null;
}

// Helper: Fetch repository files from GitHub API
async function fetchRepoFiles(owner: string, repo: string, branch: string, maxFiles: number): Promise<Array<{path: string, content: string}>> {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'fos-cli',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          const response = JSON.parse(data);
          
          if (!response.tree) {
            reject(new Error('Repository not found or branch not found'));
            return;
          }
          
          // Filter TypeScript files
          const tsFiles = response.tree
            .filter((item: any) => 
              item.type === 'blob' && 
              (item.path.endsWith('.ts') || item.path.endsWith('.tsx')) &&
              !item.path.includes('node_modules') &&
              !item.path.includes('.d.ts')
            )
            .slice(0, maxFiles);
          
          console.log(chalk.gray(`Downloading ${tsFiles.length} files...`));
          
          // Fetch file contents
          const files = [];
          for (const file of tsFiles) {
            try {
              const content = await fetchFileContent(owner, repo, file.path, branch);
              files.push({ path: file.path, content });
              
              if (files.length % 10 === 0) {
                console.log(chalk.gray(`Downloaded ${files.length}/${tsFiles.length} files...`));
              }
            } catch (error) {
              console.log(chalk.yellow(`Warning: Could not fetch ${file.path}`));
            }
          }
          
          resolve(files);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Helper: Fetch individual file content
function fetchFileContent(owner: string, repo: string, filePath: string, branch: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'fos-cli',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.content) {
            const content = Buffer.from(response.content, 'base64').toString('utf-8');
            resolve(content);
          } else {
            reject(new Error('No content found'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Helper: Create temporary project structure
async function createTempProject(tempDir: string, files: Array<{path: string, content: string}>) {
  for (const file of files) {
    const fullPath = path.join(tempDir, file.path);
    const dir = path.dirname(fullPath);
    
    // Create directory structure
    fs.mkdirSync(dir, { recursive: true });
    
    // Write file content
    fs.writeFileSync(fullPath, file.content);
  }
}

// Helper: Cleanup temporary directory
function cleanup(tempDir: string) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.log(chalk.yellow(`Warning: Could not cleanup temporary directory: ${tempDir}`));
  }
}

// Parse command line arguments
program.parse(process.argv);