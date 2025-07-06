#!/usr/bin/env node

/**
 * Function Operating System (FOS) - TypeScript Analyzer CLI
 *
 * A standalone CLI tool for analyzing TypeScript codebases.
 * Install globally: npm install -g function-os
 * Use: fos [command] [options]
 */

import chalk from "chalk"
import { Command } from "commander"
import * as fs from "fs"
import * as path from "path"
import { Node, Project, SourceFile } from "ts-morph"

// Types
interface FunctionInfo {
	id: string
	name: string
	type: "function" | "arrow" | "method" | "constructor" | "getter" | "setter"
	className?: string
	filePath: string
	line: number
	endLine: number
	size: number
	async: boolean
	exported: boolean
	params: Array<{
		name: string
		type: string
		optional: boolean
		default: string | null
	}>
	returnType: string
	calls: string[]
	callDetails: Array<{
		functionName: string
		arguments: string[]
	}>
	stateModifications: Array<{
		type: "write" | "update" | "delete" | "assign"
		target: string
	}>
	complexity: number
}

// Global state
const functions = new Map<string, FunctionInfo>()
const modules = new Map<string, string[]>()
const typeDefinitions = new Map<
	string,
	{ filePath: string; line: number; definition: string }
>()
let project: Project

// Initialize the CLI
const program = new Command()

program
	.name("fos")
	.description("Function Operating System - TypeScript Analyzer for AI Agents")
	.version("1.0.0")

// Main list command (default)
program
	.command("list [module]", { isDefault: true })
	.description("List all functions in the codebase or specific module")
	.option("-e, --exports", "Show only exported functions")
	.option(
		"-m, --module <path>",
		"Filter by module path (alternative to positional argument)"
	)
	.action((module, options) => {
		analyze()
		// Module can come from positional argument or -m option
		if (module) {
			options.module = module
		}
		cmdList(options)
	})

// Info command
program
	.command("info <function>")
	.description("Show detailed information about a function")
	.action(functionName => {
		analyze()
		cmdInfo(functionName)
	})

// Find command
program
	.command("find <pattern>")
	.description("Search functions by regex pattern")
	.action(pattern => {
		analyze()
		cmdFind(pattern)
	})

// Dependencies command
program
	.command("deps <function>")
	.description("Show function dependencies")
	.action(functionName => {
		analyze()
		cmdDeps(functionName)
	})

// Callers command
program
	.command("callers <function>")
	.description("Show functions that call this function")
	.action(functionName => {
		analyze()
		cmdCallers(functionName)
	})

// Type command
program
	.command("type <typeName>")
	.description("Show type definition")
	.action(typeName => {
		analyze()
		cmdType(typeName)
	})

// Analyze the TypeScript project
function analyze() {
	console.log(chalk.gray("Analyzing TypeScript codebase..."))

	// Find tsconfig.json
	const tsConfigPath = findTsConfig()
	if (!tsConfigPath) {
		console.error(
			chalk.red("Error: No tsconfig.json found in current directory or parent directories")
		)
		process.exit(1)
	}

	// Initialize project
	project = new Project({
		tsConfigFilePath: tsConfigPath,
	})

	// Clear previous data
	functions.clear()
	modules.clear()
	typeDefinitions.clear()

	// Analyze all source files
	const sourceFiles = project.getSourceFiles()

	sourceFiles.forEach(sourceFile => {
		const filePath = sourceFile.getFilePath()

		// Skip node_modules and build directories
		if (
			filePath.includes("node_modules") ||
			filePath.includes(".next") ||
			filePath.includes("dist")
		) {
			return
		}

		const relativePath = path.relative(process.cwd(), filePath)
		const modulePath = path.dirname(relativePath)

		// Extract functions
		const extracted = extractFunctions(sourceFile, relativePath)

		// Extract type definitions
		extractTypeDefinitions(sourceFile, relativePath)

		// Store in registry
		extracted.forEach(func => {
			functions.set(func.id, func)

			if (!modules.has(modulePath)) {
				modules.set(modulePath, [])
			}
			modules.get(modulePath)!.push(func.id)
		})
	})
}

// Find tsconfig.json
function findTsConfig(): string | null {
	let currentDir = process.cwd()
	const root = path.parse(currentDir).root

	while (currentDir !== root) {
		const tsConfigPath = path.join(currentDir, "tsconfig.json")
		if (fs.existsSync(tsConfigPath)) {
			return tsConfigPath
		}
		currentDir = path.dirname(currentDir)
	}

	return null
}

// Extract all functions from a source file
function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionInfo[] {
	const results: FunctionInfo[] = []

	// Regular functions
	sourceFile.getFunctions().forEach(func => {
		results.push(extractFunctionData(func, filePath, "function"))
	})

	// Arrow functions and function expressions
	sourceFile.getVariableDeclarations().forEach(variable => {
		const init = variable.getInitializer()
		if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
			results.push(extractFunctionData(variable, filePath, "arrow", init))
		}
	})

	// Class methods
	sourceFile.getClasses().forEach(classDecl => {
		// Constructors
		classDecl.getConstructors().forEach(constructor => {
			results.push(
				extractFunctionData(
					constructor,
					filePath,
					"constructor",
					null,
					classDecl.getName()
				)
			)
		})

		// Methods
		classDecl.getMethods().forEach(method => {
			results.push(
				extractFunctionData(method, filePath, "method", null, classDecl.getName())
			)
		})

		// Getters
		classDecl.getGetAccessors().forEach(getter => {
			results.push(
				extractFunctionData(getter, filePath, "getter", null, classDecl.getName())
			)
		})

		// Setters
		classDecl.getSetAccessors().forEach(setter => {
			results.push(
				extractFunctionData(setter, filePath, "setter", null, classDecl.getName())
			)
		})
	})

	// Extract nested functions from everywhere in the file
	extractNestedFunctions(sourceFile, filePath, results)

	return results
}

// Extract nested functions (functions inside objects, other functions, etc.)
function extractNestedFunctions(
	sourceFile: SourceFile,
	filePath: string,
	results: FunctionInfo[],
	parentPath: string = ""
) {
	sourceFile.forEachDescendant(node => {
		// Skip if we've already processed this as a top-level function
		if (Node.isFunctionDeclaration(node) && !parentPath) return

		// Object literal methods (e.g., { methodName() {} } or { methodName: function() {} })
		if (Node.isMethodDeclaration(node) || Node.isMethodSignature(node)) {
			const parent = node.getParent()
			if (Node.isObjectLiteralExpression(parent)) {
				const objectName = getObjectName(parent)
				const methodName = node.getName()
				if (methodName) {
					results.push(extractFunctionData(node, filePath, "method", null, objectName))
				}
			}
		}

		// Property assignments with functions (e.g., { prop: () => {} } or { prop: function() {} })
		if (Node.isPropertyAssignment(node)) {
			const init = node.getInitializer()
			if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
				const objectName = getObjectName(node.getParent())
				const propName = node.getName()
				// Create a synthetic node that has getName method
				const syntheticNode = {
					getName: () => propName,
					getStartLineNumber: () => node.getStartLineNumber(),
					getEndLineNumber: () => init.getEndLineNumber() || node.getEndLineNumber(),
					isExported: () => false,
					getKindName: () => "VariableDeclaration",
					getType: () => (init.getType ? init.getType() : { getText: () => "any" }),
					isAsync: () => (init.isAsync ? init.isAsync() : false),
				}
				results.push(
					extractFunctionData(syntheticNode as any, filePath, "arrow", init, objectName)
				)
			}
		}

		// Nested function declarations inside other functions
		if (Node.isFunctionDeclaration(node) && parentPath) {
			const funcName = node.getName()
			if (funcName) {
				results.push(extractFunctionData(node, filePath, "function", null, parentPath))
			}
		}

		// Nested arrow functions and function expressions inside functions
		if (Node.isVariableDeclaration(node)) {
			const init = node.getInitializer()
			if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
				// Check if this is inside another function
				const funcParent = node
					.getAncestors()
					.find(
						ancestor =>
							Node.isFunctionDeclaration(ancestor) ||
							Node.isMethodDeclaration(ancestor) ||
							Node.isArrowFunction(ancestor) ||
							Node.isFunctionExpression(ancestor)
					)

				if (funcParent) {
					const parentName = getFunctionName(funcParent)
					if (parentName) {
						results.push(extractFunctionData(node, filePath, "arrow", init, parentName))
					}
				}
			}
		}
	})
}

// Helper to get object name from parent chain
function getObjectName(node: any): string {
	// Try to find the variable/const name that holds this object
	let parent = node.getParent()
	while (parent) {
		if (Node.isVariableDeclaration(parent)) {
			return parent.getName()
		}
		if (Node.isPropertyAssignment(parent)) {
			return parent.getName() + "." + getObjectName(parent.getParent())
		}
		parent = parent.getParent()
	}
	return "anonymous"
}

// Helper to get function name from various node types
function getFunctionName(node: any): string | undefined {
	if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
		return node.getName()
	}
	if (Node.isVariableDeclaration(node)) {
		return node.getName()
	}
	if (Node.isPropertyAssignment(node)) {
		return node.getName()
	}
	return undefined
}

// Extract type definitions from a source file
function extractTypeDefinitions(sourceFile: SourceFile, filePath: string): void {
	// Extract interfaces
	sourceFile.getInterfaces().forEach(interfaceDecl => {
		const name = interfaceDecl.getName()
		typeDefinitions.set(name, {
			filePath,
			line: interfaceDecl.getStartLineNumber(),
			definition: interfaceDecl.getText(),
		})
	})

	// Extract type aliases
	sourceFile.getTypeAliases().forEach(typeAlias => {
		const name = typeAlias.getName()
		typeDefinitions.set(name, {
			filePath,
			line: typeAlias.getStartLineNumber(),
			definition: typeAlias.getText(),
		})
	})

	// Extract enums
	sourceFile.getEnums().forEach(enumDecl => {
		const name = enumDecl.getName()
		typeDefinitions.set(name, {
			filePath,
			line: enumDecl.getStartLineNumber(),
			definition: enumDecl.getText(),
		})
	})
}

// Extract detailed function data
function extractFunctionData(
	node: any,
	filePath: string,
	type: string,
	arrowFunc: any = null,
	className: string | null = null
): FunctionInfo {
	const name = node.getName ? node.getName() : "anonymous"
	const funcNode = arrowFunc || node

	// Extract parameters with types
	const params: FunctionInfo["params"] = []
	if (funcNode.getParameters) {
		funcNode.getParameters().forEach((param: any) => {
			params.push({
				name: param.getName(),
				type: cleanType(param.getType().getText()),
				optional: param.isOptional(),
				default: param.hasInitializer() ? param.getInitializer()?.getText() || null : null,
			})
		})
	}

	// Extract return type
	const returnType = funcNode.getReturnType
		? cleanType(funcNode.getReturnType().getText())
		: "void"

	// Extract function calls and state modifications
	const { calls, callDetails, stateModifications } = extractCalls(funcNode)

	// Calculate complexity (simple metric: number of calls + number of lines / 10)
	const complexity =
		calls.length + Math.floor((node.getEndLineNumber() - node.getStartLineNumber()) / 10)

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
		callDetails,
		stateModifications,
		complexity,
	}
}

// Clean up type strings
function cleanType(typeStr: string): string {
	typeStr = typeStr.replace(/import\([^)]+\)\./g, "")
	typeStr = typeStr.replace(/React\.FC<(.+)>/, "FC<$1>")
	typeStr = typeStr.replace(/React\.ReactElement/, "ReactElement")
	typeStr = typeStr.replace(/React\.ReactNode/, "ReactNode")

	if (typeStr.length > 100) {
		return typeStr.substring(0, 97) + "..."
	}

	return typeStr
}

// Extract function calls and their arguments
function extractCalls(node: any): {
	calls: string[]
	callDetails: Array<{ functionName: string; arguments: string[] }>
	stateModifications: Array<{
		type: "write" | "update" | "delete" | "assign"
		target: string
	}>
} {
	const calls = new Set<string>()
	const callDetails: Array<{ functionName: string; arguments: string[] }> = []
	const stateModifications: Array<{
		type: "write" | "update" | "delete" | "assign"
		target: string
	}> = []
	const body = node.getBody ? node.getBody() : node

	if (body && body.forEachDescendant) {
		body.forEachDescendant((child: any) => {
			if (Node.isCallExpression(child)) {
				const expr = child.getExpression()

				// Handle dynamic imports: import('./module')
				if (expr.getText() === "import") {
					const args = child.getArguments()
					if (args.length > 0) {
						const importPath = args[0].getText().replace(/['"]/g, "")
						calls.add(`import(${importPath})`)
					}
				} else if (Node.isIdentifier(expr)) {
					const funcName = expr.getText()
					calls.add(funcName)
					// Capture arguments passed to this function
					const args = child.getArguments().map(arg => arg.getText())
					callDetails.push({ functionName: funcName, arguments: args })
				} else if (Node.isPropertyAccessExpression(expr)) {
					const obj = expr.getExpression()
					const prop = expr.getName()
					if (Node.isIdentifier(obj)) {
						calls.add(`${obj.getText()}.${prop}`)
					}
				}
			}
		})
	}

	// Also look for state modifications (assignments, writes)
	if (body) {
		body.forEachDescendant((child: any) => {
			// Detect assignments
			if (Node.isBinaryExpression(child)) {
				const op = child.getOperatorToken().getText()
				if (op === "=" || op === "+=" || op === "-=") {
					const left = child.getLeft().getText()
					stateModifications.push({ type: "assign" as const, target: left })
				}
			}

			// Detect common state modification patterns
			if (Node.isCallExpression(child)) {
				const expr = child.getExpression()
				const text = expr.getText()

				if (text.includes(".push") || text.includes(".pop") || text.includes(".splice")) {
					stateModifications.push({ type: "update" as const, target: text.split(".")[0] })
				}
				if (text.includes(".set") || text.includes("setState")) {
					stateModifications.push({ type: "update" as const, target: text })
				}
				if (text.includes(".delete") || text.includes(".remove")) {
					stateModifications.push({ type: "delete" as const, target: text })
				}
				if (text.includes("writeFile") || text.includes(".write")) {
					stateModifications.push({ type: "write" as const, target: "file" })
				}
			}
		})
	}

	return {
		calls: Array.from(calls),
		callDetails,
		stateModifications,
	}
}

// Command: List all functions with complete universe data
function cmdList(options: any) {
	// Filter by module if specified
	if (options.module) {
		const originalFunctions = new Map(functions)
		functions.clear()

		// Support both exact path and partial path matching
		let modulePath = options.module.replace(/^\.?\//, "") // Remove leading ./ or /

		// Smart module resolution
		const matchedPaths = new Set<string>()

		originalFunctions.forEach((func, id) => {
			// Exact file match (with or without extension)
			if (
				func.filePath === modulePath ||
				func.filePath === modulePath + ".ts" ||
				func.filePath === modulePath + ".tsx" ||
				func.filePath.replace(/\.(ts|tsx)$/, "") === modulePath
			) {
				functions.set(id, func)
				matchedPaths.add(func.filePath)
			}
			// Directory match (path starts with module path followed by /)
			else if (func.filePath.startsWith(modulePath + "/")) {
				functions.set(id, func)
				matchedPaths.add(func.filePath)
			}
			// If module path has no extension and no /, check for both file and folder
			else if (!modulePath.includes("/") && !modulePath.includes(".")) {
				// Check if it matches a file without extension
				const fileWithoutExt = func.filePath.replace(/\.(ts|tsx)$/, "")
				const lastPart = fileWithoutExt.split("/").pop()
				if (lastPart === modulePath) {
					functions.set(id, func)
					matchedPaths.add(func.filePath)
				}
				// Check if it's a folder anywhere in the path
				else if (func.filePath.includes("/" + modulePath + "/")) {
					functions.set(id, func)
					matchedPaths.add(func.filePath)
				}
			}
		})

		// Show module-specific header with matched paths info
		console.log(chalk.cyan(`\n=== MODULE: ${modulePath} ===\n`))

		if (functions.size === 0) {
			console.log(chalk.yellow(`No functions found in module: ${modulePath}`))
		} else {
			// Show what was matched
			const uniquePaths = Array.from(matchedPaths).sort()
			const fileCount = uniquePaths.length
			const isFile =
				(fileCount === 1 && uniquePaths[0].endsWith(".ts")) ||
				uniquePaths[0].endsWith(".tsx")

			if (isFile) {
				console.log(chalk.yellow(`File: ${uniquePaths[0]}`))
			} else {
				console.log(chalk.yellow(`Matched ${fileCount} files in ${modulePath}`))
			}
			console.log(chalk.yellow(`Total functions: ${functions.size}\n`))

			// Show filtered results
			cmdUniverse(options)
		}

		// Restore original functions
		functions.clear()
		originalFunctions.forEach((func, id) => {
			functions.set(id, func)
		})
	} else {
		// Show everything
		cmdUniverse(options)
	}
}

// Command: Show function info
function cmdInfo(funcName: string) {
	const func = Array.from(functions.values()).find(
		f => f.name === funcName || f.id.endsWith(`:${funcName}`)
	)

	if (!func) {
		console.log(chalk.red(`Function "${funcName}" not found`))
		return
	}

	console.log(chalk.bold(`\nFunction: ${func.name}`))
	console.log("=".repeat(50))

	const callers = findCallers(func.name)

	console.log(
		`Type: ${func.exported ? "Exported" : "Internal"} ${func.async ? "Async" : ""} ${
			func.type
		}`
	)
	console.log(
		`Location: ${func.filePath}:${func.line}-${func.endLine} (${func.size} lines)`
	)

	if (func.params.length > 0) {
		console.log("\nParameters:")
		func.params.forEach(p => {
			const opt = p.optional ? " (optional)" : ""
			const def = p.default ? ` = ${p.default}` : ""
			console.log(`  ${p.name}: ${p.type}${opt}${def}`)
		})
	}

	console.log(`\nReturns: ${formatType(func.returnType)}`)

	if (func.calls.length > 0) {
		console.log("\nCalls:")
		func.calls.slice(0, 10).forEach(call => {
			console.log(`  ${chalk.yellow("→")} ${call}`)
		})
		if (func.calls.length > 10) {
			console.log(`  ... and ${func.calls.length - 10} more`)
		}
	}

	if (callers.length > 0) {
		console.log("\nCalled by:")
		callers.forEach(caller => {
			console.log(`  ${chalk.yellow("←")} ${caller.name} (${path.basename(caller.filePath)})`)
		})
	} else if (func.exported) {
		console.log(`\nCalled by: ${chalk.green("↗")} External consumers (exported function)`)
	} else {
		console.log(`\nCalled by: ${chalk.red("×")} None (potential dead code)`)
	}

	const link = `file://${path.resolve(func.filePath)}:${func.line}:1`
	console.log(chalk.blue(`\nDirect Access: ${chalk.underline(link)}`))
}

// Command: Find functions
function cmdFind(pattern: string) {
	// Filter functions globally before displaying
	const originalFunctions = new Map(functions)
	functions.clear()

	let regex: RegExp
	try {
		regex = new RegExp(pattern, "i") // Case insensitive
	} catch (e) {
		// Fallback to simple string match if regex is invalid
		console.log(chalk.yellow(`Invalid regex, using string match: ${pattern}`))
		originalFunctions.forEach((func, id) => {
			if (func.name.toLowerCase().includes(pattern.toLowerCase())) {
				functions.set(id, func)
			}
		})
		cmdList({ exports: false, module: null })
		functions.clear()
		originalFunctions.forEach((func, id) => {
			functions.set(id, func)
		})
		return
	}

	originalFunctions.forEach((func, id) => {
		if (regex.test(func.name)) {
			functions.set(id, func)
		}
	})

	// Display filtered results
	cmdList({ exports: false, module: null })

	// Restore original functions
	functions.clear()
	originalFunctions.forEach((func, id) => {
		functions.set(id, func)
	})
}

// Command: Show dependencies
function cmdDeps(funcName: string) {
	const func = Array.from(functions.values()).find(
		f => f.name === funcName || f.id.endsWith(`:${funcName}`)
	)

	if (!func) {
		console.log(chalk.red(`Function "${funcName}" not found`))
		return
	}

	console.log(chalk.bold(`\nDependencies: ${func.name}`))
	console.log("=".repeat(50))

	console.log("\nCalls:")
	const projectCalls = func.calls.filter(call =>
		Array.from(functions.values()).find(f => f.name === call)
	)
	if (projectCalls.length === 0) {
		console.log(`  ${chalk.red("×")} (none)`)
	} else {
		projectCalls.forEach(call => {
			const calledFunc = Array.from(functions.values()).find(f => f.name === call)
			if (calledFunc) {
				console.log(
					`  ${chalk.yellow("→")} ${call} (${path.basename(calledFunc.filePath)}:${calledFunc.line})`
				)
			}
		})
	}

	const callers = findCallers(func.name)
	console.log("\nCalled by:")
	if (callers.length === 0) {
		console.log(`  ${chalk.red("×")} (none)`)
	} else {
		callers.forEach(caller => {
			console.log(`  ${chalk.yellow("←")} ${caller.name} (${path.basename(caller.filePath)}:${caller.line})`)
		})
	}
}

// Command: Show type definition
function cmdType(typeName: string) {
	const typeDef = typeDefinitions.get(typeName)

	if (!typeDef) {
		console.log(chalk.red(`Type "${typeName}" not found`))
		return
	}

	console.log(chalk.bold(`\nType: ${typeName}`))
	console.log("=".repeat(50))
	console.log(`Location: ${typeDef.filePath}:${typeDef.line}`)
	console.log(`Definition: ${typeDef.definition}`)

	const link = `file://${path.resolve(typeDef.filePath)}:${typeDef.line}:1`
	console.log(chalk.blue(`\nDirect Access: ${chalk.underline(link)}`))
}

// Helper: Format type with clickable links
function formatType(type: string): string {
	return type
}

// Helper: Find callers
function findCallers(funcName: string): FunctionInfo[] {
	const callers: FunctionInfo[] = []
	functions.forEach(func => {
		if (func.calls.includes(funcName)) {
			callers.push(func)
		}
	})
	return callers
}

// Command: Show callers only
function cmdCallers(funcName: string) {
	const func = Array.from(functions.values()).find(
		f => f.name === funcName || f.id.endsWith(`:${funcName}`)
	)

	if (!func) {
		console.log(chalk.red(`Function "${funcName}" not found`))
		return
	}

	const callers = findCallers(func.name)
	console.log(chalk.bold(`\nFunctions calling: ${func.name}`))
	console.log("=".repeat(50))

	if (callers.length === 0) {
		console.log(`  ${chalk.red("×")} (none)`)
	} else {
		callers.forEach(caller => {
			console.log(`  ${chalk.yellow("←")} ${caller.name} (${path.basename(caller.filePath)}:${caller.line})`)
		})
	}
}

// Command: Show complete function universe as connected graph (raw data only)
function cmdUniverse(_options?: any) {
	// First show LLMs.md content
	const llmsPath = path.join(__dirname, "..", "LLMs.md")
	if (fs.existsSync(llmsPath)) {
		const llmsContent = fs.readFileSync(llmsPath, "utf8")
		console.log(chalk.cyan("\n" + llmsContent + "\n"))
		console.log(chalk.gray("=".repeat(80) + "\n"))
	}

	analyze()

	const allFunctions = Array.from(functions.values())

	if (allFunctions.length === 0) {
		console.log(chalk.yellow("No functions found in the codebase."))
		return
	}

	console.log(chalk.cyan("\n=== FUNCTION UNIVERSE ===\n"))

	// Show all functions with their raw relationships
	console.log(chalk.yellow("All Functions:\n"))

	allFunctions.forEach(func => {
		console.log(`${func.name}:`)
		console.log(`  type: ${func.type}`)
		console.log(`  async: ${func.async}`)
		console.log(`  exported: ${func.exported}`)
		console.log(`  location: ${func.filePath}:${func.line}-${func.endLine}`)

		if (func.params.length > 0) {
			console.log(`  params:`)
			func.params.forEach(param => {
				console.log(
					`    ${chalk.gray("├─")} ${param.name}: ${param.type}${param.optional ? "?" : ""}${
						param.default ? ` = ${param.default}` : ""
					}`
				)
			})
		}

		if (func.returnType) {
			console.log(`  returns: ${func.returnType}`)
		}

		if (func.calls.length > 0) {
			console.log(`  calls:`)
			func.calls.forEach(call => {
				console.log(`    ${chalk.yellow("→")} ${call}`)
			})
		}

		if (func.callDetails && func.callDetails.length > 0) {
			console.log(`  data flow:`)
			func.callDetails.forEach(detail => {
				if (detail.arguments.length > 0) {
					console.log(`    ${detail.functionName}(${detail.arguments.join(", ")})`)
				}
			})
		}

		if (func.stateModifications && func.stateModifications.length > 0) {
			console.log(`  modifies:`)
			func.stateModifications.forEach(mod => {
				console.log(`    ${chalk.red("⤵")} ${mod.type}: ${mod.target}`)
			})
		}

		console.log(`  complexity: ${func.complexity}`)
		console.log()
	})

	// Show function call graph with data flow
	console.log(chalk.yellow("Function Call Graph:\n"))

	allFunctions.forEach(func => {
		if (func.callDetails && func.callDetails.length > 0) {
			func.callDetails.forEach(detail => {
				if (detail.arguments.length > 0) {
					console.log(
						`${func.name} ${chalk.yellow("→")} ${detail.functionName}(${detail.arguments.join(", ")})`
					)
				} else {
					console.log(`${func.name} ${chalk.yellow("→")} ${detail.functionName}()`)
				}
			})
		} else if (func.calls.length > 0) {
			func.calls.forEach(calledFunc => {
				console.log(`${func.name} ${chalk.yellow("→")} ${calledFunc}`)
			})
		}
	})

	// Show who calls whom (reverse dependencies)
	console.log(chalk.yellow("\nReverse Dependencies:\n"))

	const calledByMap = new Map<string, string[]>()

	allFunctions.forEach(func => {
		func.calls.forEach(calledFunc => {
			if (!calledByMap.has(calledFunc)) {
				calledByMap.set(calledFunc, [])
			}
			calledByMap.get(calledFunc)!.push(func.name)
		})
	})

	calledByMap.forEach((callers, funcName) => {
		console.log(`${funcName} ${chalk.yellow("←")} [${callers.join(", ")}]`)
	})

	// Show functions that don't call anyone
	console.log(chalk.yellow("\nLeaf Functions (no calls):\n"))
	const leafFunctions = allFunctions.filter(f => f.calls.length === 0)
	leafFunctions.forEach(func => {
		console.log(`${chalk.gray("└─")} ${func.name}`)
	})

	// Show functions that aren't called by anyone
	console.log(chalk.yellow("\nRoot Functions (not called):\n"))
	const rootFunctions = allFunctions.filter(
		func => !allFunctions.some(f => f.calls.includes(func.name))
	)
	rootFunctions.forEach(func => {
		console.log(`${chalk.yellow("⤴")} ${func.name}`)
	})

	// Show state-modifying functions
	console.log(chalk.yellow("\nState-Modifying Functions:\n"))
	const stateModifiers = allFunctions.filter(
		f => f.stateModifications && f.stateModifications.length > 0
	)
	stateModifiers.forEach(func => {
		console.log(`${func.name}:`)
		func.stateModifications.forEach(mod => {
			console.log(`  ${chalk.red("⤵")} ${mod.type} ${chalk.yellow("→")} ${mod.target}`)
		})
	})

	// Show async call chains
	console.log(chalk.yellow("\nAsync Functions:\n"))
	const asyncFunctions = allFunctions.filter(f => f.async)
	asyncFunctions.forEach(func => {
		console.log(
			`${chalk.cyan("⟳")} ${func.name}${func.calls.length > 0 ? ` ${chalk.yellow("→")} [${func.calls.join(", ")}]` : ""}`
		)
	})

	// Show exported vs internal
	console.log(chalk.yellow("\nExported Functions:\n"))
	const exportedFunctions = allFunctions.filter(f => f.exported)
	exportedFunctions.forEach(func => {
		console.log(`${chalk.green("↗")} ${func.name}`)
	})

	console.log(chalk.yellow("\nInternal Functions:\n"))
	const internalFunctions = allFunctions.filter(f => !f.exported)
	internalFunctions.forEach(func => {
		console.log(`${chalk.gray("├─")} ${func.name}`)
	})
}

// Parse command line arguments
program.parse(process.argv)
