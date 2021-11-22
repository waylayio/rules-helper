# Waylay Task SDK

## intro

This library will allow the user to create waylay tasks in an easier way.

There's two ways to use this library:

* with a config and the so called subflows
* with a chain style builder which requires no config

More on the specific ways below.

This is **not** a UI library.

## Installation

```cli
npm install @waylay/rules-helper
```

## Types

Both types of builders below will have the same result which is a task / template created on the Waylay engine.

### Subflow

The subflow builder uses the so called subflows as the main components. Each of these subflows has to be defined in the config which has to be passed to the builder on initialisation.

A subflow should be seen as a wrapper for waylay plugins which will be executed sequentially. These can then be used in the UI to hide complex waylay logic.

### Chain

The chain builder is the most straight forward one to use seeing as it doesn't need a config to work. The downside to this is that more Waylay logic will have to be applied as a user / through the UX.