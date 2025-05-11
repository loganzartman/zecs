# zecs

strongly-typed, unopinionated, fast-enough **entity-component-system** system for hobby use

tightly integrated with [zod](https://zod.dev/) for schemas

`pnpm add zecs`

`npm install --save zecs`

## usage example

create a system of components and behaviors:

https://github.com/loganzartman/zecs/blob/181b1cfc42bb3b0c847480fc4615758f4523a9af/example/exampleSystem.ts#L1-L221

game loop:

https://github.com/loganzartman/zecs/blob/181b1cfc42bb3b0c847480fc4615758f4523a9af/example/example.ts#L16-L25

## features

we've got the basics:

* `entity`: plain typescript object; each top level field is a component
* `component`: a name/key and a zod schema 
* `ecs`: a set of possible components and a collection of entities 
* `query`: selects entities with a specific shape
  * use this to build "systems"

and for a limited time only:

* `toJSON` and `fromJSON`: turn an `ecs` to and from a plain object
* `alias` for assigning a key to a specific entity
* `singleton` for storing a unique object (and maybe serializing it)
* `event`: tiny, strongly-typed event emitter
* airtight, intuitive types
