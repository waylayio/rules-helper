# Waylay Rules Helper

## intro

This library will allow the user to create waylay tasks in an easier way.

There's two ways to use this library:

* with a config and the so called subflows
* with a chain style builder which requires no config, and adheres to the waylay format of plugins.

More on the specific ways below.

This is **not** a UI library.

## Installation

```cli
npm install @waylay/rules-helper
```

## Subflow

The subflow builder uses the so called subflows as the main components. Each of these subflows has to be defined in the config which has to be passed to the builder on initialisation.

A subflow should be seen as a wrapper for waylay plugins which will be executed sequentially. These can then be used in the UI to hide complex waylay logic.

### Subflow configuration

A subflow requires a *name*, *description*, *properties* and a list of waylay *plugins*
You can template the input params of a waylay plugin through the properties of the subflow. Use the template notation seen below on *resource*, to use the input as an argument of the plugin. 

a keyword that's always available is *<%previousNode%>*. This way you can access data from the previously configured waylay plugin.

```javascript
[
  {
    name: 'exit geofence',
    description: 'Checks if a resource entered a geofence',
    properties: {
      resource: {
        type: 'string'
      }
    },
    plugins: [{
      name: 'stream',
      type: 'sensor',
      version: '1.0.0',
      properties: {
        resource: '<%properties.resource%>'
      },
      dataTrigger: true,
      tickTrigger: false,
      triggers: [
        'Data'
      ]
    },
    {
      name: 'condition',
      version: '1.1.0',
      type: 'sensor',
      properties: {
        condition: '${<%previousNode%>.rawData.stream.direction} === "EXIT"',
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'True'
      ]
    }]
  }
]
```

### Setting up the package

To use the subflow part of the waylay task-helper, you need to setup the waylay helper with the clientId, secret and domain of your waylay instance. The config is the array of subflows as configured above.

```javascript
const Helper = require('@waylay/rules-helper')

const { subflow } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN, config: exampleConfig })
```

### Builder

#### Starting the builder
To use the builder you need to create a subflow builder instance.
```javascript
const builder = subflow.createTaskBuilder()
```

#### Step
A step consists of 2 parts, the name of the subflow you want to use for the step and the properties defined on that subflow.

```javascript
{
    name: 'exit geofence',
    properties: {
        resource: 'test resource'
    }
}
```

#### Get al configured subflows
```javascript
getSubflows()
```
Gives you a list of all configured subflows.

#### Add step
```javascript
addStep(step)
```
Adds the step at the end of the currently configured steps.

#### Add steps with AND gate
```javascript
addAndGate([step])
```
Adds the steps passed to the function at the end of the currently configured steps. It will combine them in a logical AND gate.

#### Add steps with OR gate
```javascript
addOrGate([step])
```
Adds the steps passed to the function at the end of the currently configured steps. It will combine them in a logical OR gate.

#### Remove the last configured step
```javascript
removeStep()
```
Removes the last configured step, if the last one was a gate step, it will remove all those steps.

#### Get all configured steps
```javascript
getSteps()
```
Gives back all currently configured steps.

#### Create a task (Async)
```javascript
createTask(name, options)
```
Creates a task on the waylay engine, you should pass a name to the task. In the options you can pass all options that are available on a task (docs link to be added)

#### create a template (Async)
```javascript
createTemplate(name)
```
Creates a template on the waylay engine. You should pass a name to the template.

All these steps can be chained after one another
```javascript
builder
    .addStep(dummyStepStream)
    .addAndGate([dummyStep, dummyStep])
    .addStep(dummyActuator)
    .createTask('subflow builder example test', {})
```

## Chain

The chain builder is the most straight forward one to use seeing as it doesn't need a config to work. The downside to this is that more Waylay logic will have to be applied as a user / through the UX.

### Setting up the package
To use the chain part of the waylay task-helper, you need to setup the waylay helper with the clientId, secret and domain of your waylay instance. The chain part of the task-helper doesn't require a configuration.

```javascript
const Helper = require('@waylay/rules-helper')

const { chain } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN })
```

### Builder

#### List all plugins
```javascript
const { sensors, actuators } = await chain.getPlugins()
```
Returns a list of all plugins active on your waylay instance. seperated into the categories sensors and actuators.

#### Starting the builder
To use the builder you need to create a chain builder instance.
```javascript
const builder = chain.createBuilder()
```

#### Step
The steps of the chain builder adhere to the waylay format of plugins.
```javascript
{
    name: 'inRange',
    type: 'sensor',
    version: '1.0.2',
    properties: {
        value: '${task.streamData}'
    },
    states: ['Above', 'In Range'],
    dataTrigger: true,
    tickTrigger: true
}
```

#### Add step
```javascript
addStep(step)
```
Adds the step at the end of the currently configured steps.

#### Add steps with AND gate
```javascript
addAndGate([step])
```
Adds the steps passed to the function at the end of the currently configured steps. It will combine them in a logical AND gate.

#### Add steps with OR gate
```javascript
addOrGate([step])
```
Adds the steps passed to the function at the end of the currently configured steps. It will combine them in a logical OR gate.

#### Remove the last configured step
```javascript
removeStep()
```
Removes the last configured step, if the last one was a gate step, it will remove all those steps.

#### Create a task (Async)
```javascript
createTask(name, options)
```
Creates a task on the waylay engine, you should pass a name to the task. In the options you can pass all options that are available on a task (docs link to be added)