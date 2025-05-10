# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Type checking
pnpm types

# Linting
pnpm check        # Check for linting issues
pnpm check:fix    # Fix linting issues automatically 

# Run tests
pnpm test         # Run all tests
npx jest src/file.test.ts  # Run specific test file

# Run example
pnpm example      # Runs the example in a browser

# Run benchmarks
pnpm bench        # Run benchmarks
pnpm bench-debug  # Run benchmarks with debugging

# CI checks (run all checks that would be run in CI)
pnpm ci-checks
```

## Architecture

ZECS is a strongly-typed entity-component-system (ECS) implementation built with TypeScript and Zod.

### Core Concepts

1. **Entity**: A plain TypeScript object where each top-level field is a component
2. **Component**: A name/key and a Zod schema that defines the structure and validation
3. **ECS**: A container that manages a set of possible components and a collection of entities
4. **Query**: Used to select entities with a specific shape (components)
5. **Behavior**: A logic unit that processes entities matching a specific query
6. **Plan**: Organizes behaviors into a dependency graph for execution
7. **Observer**: Watches for changes in entity state and emits events
8. **System**: Defines structure for processing entities (NEW)

### Data Flow

1. Components are defined with Zod schemas
2. An ECS instance is created with the components
3. Entities are added to the ECS
4. Behaviors define processing logic for entities matching specific queries
5. A Plan is created to organize the execution of behaviors with dependencies
6. The update cycle executes behaviors according to the plan

### Key Files

- `src/component.ts`: Component definition and utilities
- `src/ecs.ts`: Core entity-component-system implementation
- `src/query.ts`: Query system for selecting entities
- `src/behavior.ts`: Behavior system for defining logic
- `src/plan.ts`: Plan system for executing behaviors in dependency order
- `src/observe.ts`: Observer system for reacting to entity changes
- `src/event.ts`: Event system for communication
- `src/system.ts`: New system structure (recently added)

### Type System

The library uses extensive TypeScript typing to provide compile-time safety:
- Generic type parameters to enforce type consistency
- Zod schemas for runtime validation
- Type inference to maintain type information throughout the system

### Example

See `example/exampleSystem.ts` for a complete example of creating components, behaviors, and executing them in a plan.

## Project Standards

- Uses Biome for linting and formatting (formerly Rome)
- Uses Jest for testing
- Uses TypeScript with strict typechecking
- ESM modules