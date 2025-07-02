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
  isComponent: boolean;
  purpose: string;
}

// Global state
const functions = new Map<string, FunctionInfo>();
const modules = new Map<string, string[]>();
let project: Project;

// Initialize the CLI
const program = new Command();

program
  .name('fos')
  .description(`Function Operating System - TypeScript Analyzer for AI Agents

CONTEXT: AI agents need to understand TypeScript codebases without reading entire files.

INTENTION: → Enable surgical code reading through function-level analysis.

WORKFLOW:

  fos                    # Lists all functions with locations (30 seconds)
  fos find auth          # Filters functions by pattern (10 seconds)
  fos analyze            # Identifies inefficiencies (20 seconds)
  fos read func1 func2   # Generates sed commands for specific functions (1 minute)
  fos deps useAuth       # Shows function dependencies (10 seconds)
  fos info CTASection    # Displays function details (when needed)

WHAT THE ANALYZER SHOWS:
- Function locations (file:startLine-endLine)
- Export status [Export] or [Internal]
- Component markers [Component]
- Function signatures and parameters

PRACTICAL USAGE:

Finding code:
  fos find profile       # Shows profile-related functions
  fos info MiniProfile   # Shows complexity score and details
  fos read MiniProfile   # Outputs: sed -n '15,278p' src/components/MiniProfile.tsx

Analyzing health:
  fos analyze            # Shows single-use functions, highly complex functions, dead code

Understanding connections:
  fos deps useAuth       # Shows what useAuth calls and what calls useAuth

TIME COMPARISON:
- Reading files manually: 50+ minutes
- Using FOS: 2 minutes

CONSTRAINTS:
- Requires TypeScript project with tsconfig.json
- Functions must be named (anonymous functions excluded)
- Analyzes .ts and .tsx files only

VALIDATION: sed commands output exact function bodies for precise reading.`)
  .version('1.0.0');

// Main list command (default)
program
  .command('list', { isDefault: true })
  .description('List all functions in the codebase')
  .option('-e, --exports', 'Show only exported functions')
  .option('-c, --complex', 'Show only highly complex functions (complexity > 50)')
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
  .description('Search functions by name pattern')
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
  .description('Analyze code health and find inefficiencies')
  .action(() => {
    analyze();
    cmdAnalyze();
  });

// Read command
program
  .command('read <functions...>')
  .description('Generate commands to read specific function bodies')
  .action((functionNames) => {
    analyze();
    cmdRead(functionNames);
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

  // Calculate complexity
  const complexity = calculateComplexity(funcNode);

  // Check if it's a React component
  const isComponent = isReactComponent(funcNode, name);

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
    isComponent,
    purpose: inferPurpose(name, calls, isComponent, returnType)
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

// Calculate cyclomatic complexity
function calculateComplexity(node: any): number {
  let complexity = 1;
  const body = node.getBody ? node.getBody() : node;

  if (body && body.forEachDescendant) {
    body.forEachDescendant((child: any) => {
      if (Node.isIfStatement(child) ||
          Node.isConditionalExpression(child) ||
          Node.isForStatement(child) ||
          Node.isWhileStatement(child) ||
          Node.isDoStatement(child) ||
          Node.isCaseClause(child)) {
        complexity++;
      }
    });
  }

  return complexity;
}

// Check if function is a React component
function isReactComponent(node: any, name: string): boolean {
  if (!/^[A-Z]/.test(name)) return false;

  const returnType = node.getReturnType ? node.getReturnType().getText() : '';
  return returnType.includes('Element') || returnType.includes('ReactNode') || returnType.includes('JSX');
}

// Infer function purpose
function inferPurpose(name: string, calls: string[], isComponent: boolean, returnType: string): string {
  if (isComponent) return 'React component';
  if (name.startsWith('use')) return 'React hook';
  if (name.startsWith('get')) return 'Getter function';
  if (name.startsWith('set')) return 'Setter function';
  if (name.startsWith('handle')) return 'Event handler';
  if (name.startsWith('on')) return 'Event callback';
  if (calls.some(c => c.includes('supabase') || c.includes('fetch') || c.includes('axios'))) return 'API operation';
  if (returnType.includes('Promise')) return 'Async operation';
  return 'Utility function';
}

// Command: List all functions
function cmdList(options: any) {
  console.log(chalk.bold('\nTypeScript Functions\n'));

  let filtered = Array.from(functions.values());

  // Apply filters
  if (options.exports) {
    filtered = filtered.filter(f => f.exported);
  }
  if (options.complex) {
    filtered = filtered.filter(f => f.complexity > 50);
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
      const icon = func.isComponent ? '[Component]' : func.async ? '[Async]' : '';
      const exp = func.exported ? chalk.green('[Export]') : chalk.gray('[Internal]');
      const complex = func.complexity > 50 ? chalk.red(' [Complex]') : '';
      const paramDisplay = formatParams(func.params, true);

      console.log(`${exp} ${icon} ${chalk.cyan(func.name)}(${paramDisplay})${complex}`);
      console.log(chalk.gray(`  ${func.filePath}:${func.line}-${func.endLine}`));
    });
  });

  console.log(chalk.bold(`\nTotal: ${filtered.length} functions`));
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

  console.log(`Type: ${func.exported ? 'Exported' : 'Internal'} ${func.isComponent ? 'Component' : func.async ? 'Async' : 'Function'}`);
  console.log(`Purpose: ${func.purpose}`);
  console.log(`Location: ${func.filePath}:${func.line}-${func.endLine} (${func.size} lines)`);
  console.log(`Complexity: ${func.complexity} ${func.complexity > 50 ? '(Highly Complex)' : func.complexity > 20 ? '(Complex)' : func.complexity > 10 ? '(Moderate)' : '(Simple)'}`);

  if (func.params.length > 0) {
    console.log('\nParameters:');
    func.params.forEach(p => {
      const opt = p.optional ? ' (optional)' : '';
      const def = p.default ? ` = ${p.default}` : '';
      console.log(`  ${p.name}: ${p.type}${opt}${def}`);
    });
  }

  console.log(`\nReturns: ${func.returnType}`);

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

  originalFunctions.forEach((func, id) => {
    if (func.name.toLowerCase().includes(pattern.toLowerCase())) {
      functions.set(id, func);
    }
  });

  // Display filtered results
  cmdList({ exports: false, complex: false, module: null });

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
  if (func.calls.length === 0) {
    console.log('  (none)');
  } else {
    func.calls.forEach(call => {
      const calledFunc = Array.from(functions.values()).find(f => f.name === call);
      if (calledFunc) {
        console.log(`  - ${call} (${path.basename(calledFunc.filePath)}:${calledFunc.line})`);
      } else {
        console.log(`  - ${call} (external)`);
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
    complex: 0,
    totalSize: 0,
    totalComplexity: 0
  };

  let largest: FunctionInfo | null = null;
  let mostComplex: FunctionInfo | null = null;
  const callCounts = new Map<string, number>();

  functions.forEach(func => {
    if (func.isComponent) stats.components++;
    if (func.name.startsWith('use') && !func.isComponent) stats.hooks++;
    if (func.async) stats.async++;
    if (func.exported) stats.exported++;
    if (func.complexity > 50) stats.complex++;

    stats.totalSize += func.size;
    stats.totalComplexity += func.complexity;

    if (!largest || func.size > largest.size) largest = func;
    if (!mostComplex || func.complexity > mostComplex.complexity) mostComplex = func;

    func.calls.forEach(call => {
      callCounts.set(call, (callCounts.get(call) || 0) + 1);
    });
  });

  console.log(`Total Functions: ${stats.total}`);
  console.log(`React Components: ${stats.components}`);
  console.log(`React Hooks: ${stats.hooks}`);
  console.log(`Async Functions: ${stats.async}`);
  console.log(`Exported: ${stats.exported}`);
  console.log(`Highly Complex (>50): ${stats.complex}`);
  console.log(`\nAverage Size: ${Math.round(stats.totalSize / stats.total)} lines`);
  console.log(`Average Complexity: ${(stats.totalComplexity / stats.total).toFixed(1)}`);

  if (largest) {
    console.log(`\nLargest: ${(largest as FunctionInfo).name} (${(largest as FunctionInfo).size} lines)`);
  }
  if (mostComplex) {
    console.log(`Most Complex: ${(mostComplex as FunctionInfo).name} (${(mostComplex as FunctionInfo).complexity})`);
  }

  console.log('\nMost Called:');
  Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count} times`);
    });
}

// Command: Analyze code health
function cmdAnalyze() {
  console.log(chalk.bold('\nFunction Analysis Report'));
  console.log('='.repeat(50));

  // Find single-use functions
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

  const singleUse = Array.from(functions.values()).filter(f => {
    const count = callCounts.get(f.name) || 0;
    return count === 1 && !f.exported && !f.isComponent;
  });

  if (singleUse.length > 0) {
    console.log('\nSingle-Use Functions (consider inlining):');
    singleUse.forEach(func => {
      const caller = findCallers(func.name)[0];
      console.log(`- ${func.name} (${func.filePath}:${func.line})`);
      if (caller) console.log(`  Only called by: ${caller.name}`);
    });
  }

  // Find overly popular functions
  const popular = Array.from(callCounts.entries())
    .filter(([, count]) => count > 5)
    .sort((a, b) => b[1] - a[1]);

  if (popular.length > 0) {
    console.log('\nHighly Connected Functions (potential refactoring targets):');
    popular.forEach(([name, count]) => {
      const func = Array.from(functions.values()).find(f => f.name === name);
      if (func) {
        console.log(`- ${name} called ${count} times`);
        const callers = findCallers(name);
        const modules = new Set(callers.map(c => path.dirname(c.filePath)));
        if (modules.size > 3) {
          console.log(`  WARNING: Called from ${modules.size} different modules`);
        }
      }
    });
  }

  // Find highly complex functions
  const complex = Array.from(functions.values())
    .filter(f => f.complexity > 50)
    .sort((a, b) => b.complexity - a.complexity);

  if (complex.length > 0) {
    console.log('\nHighly Complex Functions (consider breaking down):');
    complex.slice(0, 5).forEach(func => {
      console.log(`- ${func.name} (complexity: ${func.complexity})`);
      console.log(`  ${func.filePath}:${func.line}-${func.endLine}`);
    });
  }

  // Find disconnected functions (only show exported functions that are unused)
  const disconnected = Array.from(functions.values()).filter(f => {
    const calledCount = callCounts.get(f.name) || 0;
    return calledCount === 0 && f.calls.length === 0 && f.exported && !f.isComponent;
  });

  if (disconnected.length > 0) {
    console.log('\nDisconnected Functions (dead code?):');
    disconnected.forEach(func => {
      console.log(`- ${func.name} (${func.filePath}:${func.line})`);
    });
  }

  // Dependency Graph Analysis
  console.log('\nDependency Graph Analysis:');
  console.log('='.repeat(50));
  
  // Build adjacency list for the dependency graph
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
  
  console.log(`\nFound ${components.length} dependency groups:`);
  
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
function cmdRead(functionNames: string[]) {
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
  console.log('Run these commands in parallel to read function bodies:\n');

  funcsToRead.forEach(func => {
    console.log(chalk.gray(`# ${func.name} (${func.purpose})`));
    console.log(`sed -n '${func.line},${func.endLine}p' ${func.filePath}`);
    console.log();
  });

  console.log('Or read all at once:');
  const combined = funcsToRead.map(f =>
    `echo "=== ${f.name} ===" && sed -n '${f.line},${f.endLine}p' ${f.filePath}`
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
      console.log(`- **${f.name}**(${formatParams(f.params, true)}) → ${f.returnType}`);
    });

    console.log('\n## Internal');
    moduleFuncs.filter(f => !f.exported).forEach(f => {
      console.log(`- ${f.name}() - ${f.purpose}`);
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
    console.log(`**Purpose**: ${func.purpose}`);
    console.log(`**Location**: ${func.filePath}:${func.line}`);
    console.log(`**Signature**: ${func.name}(${formatParams(func.params, true)}) → ${func.returnType}`);

    if (func.calls.length > 0) {
      console.log(`\n**Dependencies**: ${func.calls.join(', ')}`);
    }
  } else {
    console.log(chalk.bold('# Function Overview\n'));
    console.log(`Total: ${functions.size} functions\n`);

    const byPurpose = new Map<string, FunctionInfo[]>();
    functions.forEach(f => {
      if (!byPurpose.has(f.purpose)) byPurpose.set(f.purpose, []);
      byPurpose.get(f.purpose)!.push(f);
    });

    byPurpose.forEach((funcs, purpose) => {
      console.log(`## ${purpose} (${funcs.length})`);
      funcs.slice(0, 5).forEach(f => {
        console.log(`- ${f.name}() - ${path.basename(f.filePath)}`);
      });
      if (funcs.length > 5) console.log(`- ... and ${funcs.length - 5} more`);
      console.log();
    });
  }
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
      return `${p.name}: ${p.type}${p.optional ? '?' : ''}`;
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

// Parse command line arguments
program.parse(process.argv);