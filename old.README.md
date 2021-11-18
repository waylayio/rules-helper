# Waylay Task SDK

## intro

This npm library will allow the user to create waylay tasks in an easier way. This is **not** a UI library.

## Installation

```cli
npm install @waylay/rules-sdk
```

## Configuration
Probably the most complicated part of using the SDK is setting up the config. The config allows you to wrap Waylay plugins so they can be used in a simplified UI.

### usage

**Config consists of an array of configurations.**

Under the properties field **JSON schema** syntax has to be used and this will be used to validate incoming values when submitting a task.

Each plugin under the **plugins** will be executed sequentially by using the defined **triggers**. When chaining multiple wrapped plugins together the triggers of the last plugin will be used for the next wrapped plugin.
Other properties under **plugins** are waylay specific and can be found in the waylay documentation.

Through the config templating can be used with **<% %>**. The context available for the template contains the **properties** passed when creating a task and the label of the node before it under **previousNode**.

The config will be **validated** when passing it to the constructor and result in an error being thrown in case the config is invalid.

Example:

Comparing a value against a condition consists of two steps, first getting the value and then using that result in the comparison. Through the config both of these can be wrapped and then used as a single node.

Setting this in the config would look like this:
```javascript
[
  {
    name: 'Check condition',
    description: 'check if a resource metric is above below or equal to a certain value',
    properties: {
      condition: {
        type: 'string',
        enum: ['>', '<', '=']
      },
      value: {
        type: 'number'
      }
    },
    plugins: [{
      name: 'getLastValueFromTS',
      type: 'sensor',
      version: '1.0.4',
      properties: {
        resource: '$',
        metric: 'engine'
      },
      dataTrigger: true,
      tickTrigger: true,
      triggers: [
        'Collected'
      ]
    },
    {
      name: 'condition',
      version: '1.1.6',
      type: 'sensor',
      properties: {
        condition: '${<%previousNode%>.lastValue} <%properties.condition%> <%properties.value%>' //eslint-disable-line
      },
      dataTrigger: true,
      tickTrigger: true,
      triggers: [
        'True'
      ]
    }]
  },
  {
    name: 'AND Gate',
    description: 'gate to combine inputs, will continue if all inputs are truthy',
    plugins: [{
      name: 'AND',
      version: '1.0.4',
      type: 'gate',
      dataTrigger: true,
      tickTrigger: true,
      triggers: [
        'TRUE'
      ]
    }]
  },
  {
    name: 'Send Alarm',
    description: 'sends an alarm',
    properties: {
      type: {
        type: 'string'
      },
      resource: {
        type: 'string'
      },
      text: {
        type: 'string'
      },
      severity: {
        type: 'string'
      }
    },
    plugins: [{
      name: 'waylayAlarm',
      version: '1.0.2',
      type: 'actuator',
      properties: {
        type: '<%properties.type%>',
        resource: '<%properties.resource%>',
        text: '<%properties.text%>',
        severity: '<%properties.severity%>'
      },
      dataTrigger: true,
      tickTrigger: true,
      triggers: []
    }]
  }
]
```

## Usage

The SDK exposes the following functions:
- createTask
  - creates a task on the Waylay engine through some steps, see below.
- getPlugins
  - returns an array of configured wrapped plugins

Code example:
```javascript
const SDK = require('@waylay/rules-sdk')
const exampleConfig = // some config
const exampleInput = // some input

const sdkClient = new SDK({
  token: // waylay token,
  api: // waylay api url,
  config: exampleConfig
})

async function test () {
  await sdkClient.createTask({
    name: 'test task waylay sdk',
    steps: exampleInput
  })
}

test()

```

### createTask
To create a task on object must be passed with a **name** and a **steps** array. Every step can have a certain amount of **targets** which will be chained together. There has to be at least one step without targets.

Example:
```javascript
[
  {
    id: 0,
    name: 'Check condition',
    properties: {
      condition: '>',
      value: 10,
      resource: 'resource1'
    },
    target: [1, 2]
  },
  {
    id: 1,
    name: 'Check condition',
    properties: {
      condition: '=',
      value: 100,
      resource: 'resource2'
    },
    target: [3]
  },
  {
    id: 2,
    name: 'Check condition',
    properties: {
      condition: '>',
      value: 200,
      resource: 'resource3'
    },
    target: [3]
  },
  {
    id: 3,
    name: 'AND Gate',
    target: [4]
  },
  {
    id: 4,
    name: 'Send Alarm',
    properties: {
      type: 'some alarm type',
      resource: 'resource4',
      text: 'alarming values',
      severity: 'CRITICAL'
    }
  }
]
```

## Builder

### Setup
For starting a new builder you need to pass the name for your task
```javascript
const builder = client.createTaskBuilder({ name: 'the name of your rule' })
```

### Get Plugins
Returns all configured steps that are available to the taskBuilder
```javascript
builder.getPlugins()
```

### Add Step
Adds a new step to your task
```javascript
builder.addStep({
  name: 'name of your selected step',
  // Object of properties of your selected step
  properties: { key: value }
})
```

### Remove Step
Removes the last added step from your task
```javascript
builder.removeStep()
```

### Get Steps
Returns the current configured steps in your task
```javascript
builder.getSteps()
```

### Create Task
Parses the configured tasks to the correct waylay format and pushes it to the configured engine
```javascript
builder.createTask()
```