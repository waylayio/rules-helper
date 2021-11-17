/* eslint-disable */
module.exports = [
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
        condition: '${<%previousNode%>.rawData.stream.direction} === "EXIT"', //eslint-disable-line
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'True'
      ]
    }]
  },
  {
    name: 'truck engine idle',
    description: 'check if the resource engine is turned off',
    properties: {
      resource: {
        type: 'string'
      }
    },
    plugins: [{
      name: 'getLatestMetrics',
      type: 'sensor',
      version: '2.0.2',
      properties: {
        resource: '<%properties.resource%>'
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'Collected'
      ]
    },
    {
      name: 'condition',
      version: '1.1.0',
      type: 'sensor',
      properties: {
        condition: '${<%previousNode%>.rawData.engine_idle === true',
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'True'
      ]
    }]
  },
  {
    name: 'truck standing still',
    description: 'check if the resource speed is 0',
    properties: {
      resource: {
        type: 'string'
      }
    },
    plugins: [{
      name: 'getLatestMetrics',
      type: 'sensor',
      version: '2.0.2',
      properties: {
        resource: '<%properties.resource%>'
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'Collected'
      ]
    },
    {
      name: 'condition',
      version: '1.1.0',
      type: 'sensor',
      properties: {
        condition: '${<%previousNode%>.rawData.speed === 0',
      },
      dataTrigger: false,
      tickTrigger: false,
      triggers: [
        'True'
      ]
    }]
  },
  {
    name: 'alert message',
    description: 'sends an alarm',
    properties: {
      message: {
        type: 'string'
      }
    },
    plugins: [{
      name: 'debugDialog',
      version: '1.0.4',
      type: 'actuator',
      properties: {
        message: '<%properties.message%>'
      }
    }]
  }
]
