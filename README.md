# zecs

strongly-typed, unopinionated, fast-enough **entity-component-system** system for hobby use

tightly integrated with [zod](https://zod.dev/) for schemas

```sh
pnpm add zecs
```

```sh
npm install --save zecs
```

```sh
yarn add zecs
```

you can import individual pieces, or the whole thing:

```ts
import {component, query} from 'zecs';
import {zecs} from 'zecs';
```

> [!WARNING]
> zecs is outsider art. i don't really make games, i just write typescript a lot and i'm making a game for fun.
> 
> i'm discovering what works as i go.

## basics

zecs is a composition-based approach to organizing data and updates!

### component

**components** are just [zod types](https://zod.dev/?id=introduction) with names:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L9-L17

### entity

**entities** are plain objects where each property matches a component:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L20-L23

### ecs

an **ecs** stores entities that conform to some set of components:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L26-L27

> [!NOTE]
> every component is optional! this allows behavior to differ between entities, and it's why we need queries.

### query

**queries** select entities based on what components they have...

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L30-L36

or any condition you want:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L41-L50

## serialization

every zecs ECS is serializable, meaning that it can be converted to and from a plain object:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L56-L62

components may contain other entities, and zecs will automatically convert them to and from references when serializing:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L65-L74

## system

it's just fine to put a query in a function and be done with it.

i'll also offer you the **system**. the simplest system is just like looping over every entity in a query:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L77-L91

a system, much like a component or a query, is just a description. **attaching** the system to an ECS returns a stateful "handle", which can be `.update()` every frame or step.

### resources

a system can also have **resources**--both **shared** and for **each** entity:

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L149-L185

**shared** resources get created when the system is **attached** to an ECS. in most cases, this is just once.

**each** resources are created for each entity that matches the query. they persist as long as it keeps matching, and then they get destroyed.

## schedule

you can attach an individual system to an ECS and update it by hand, but what if you have a lot?

sure can be tedious to juggle a bunch of system `update()`s.

schedules take a list of systems and give you a handle to update all of them at once (in a strongly-typed fashion, of course.)

if you know that one system should run after another--for example, apply gravity before integrating velocity--you can declare that in the `deps`. the scheduler will sort them for you.

https://github.com/loganzartman/zecs/blob/d9a37c34e41668d38e9a66013ccb5b59133cce79/example/docs.ts#L190-L223
