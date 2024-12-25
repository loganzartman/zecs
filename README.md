# zecs

strongly-typed, unopinionated, fast-enough **entity-component-system** system for hobby use

`pnpm add zecs`

`npm i --save zecs`

## usage example

https://github.com/loganzartman/zecs/blob/2eca8891edbac3e591cd8d14b11c43b12901c0a0/src/index.test.ts#L8-L57

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
* airtight, intuitive types
