module.exports = [
  {
    id: 0,
    name: 'exit geofence',
    properties: {
      resource: 'resource1'
    },
    target: [1]
  },
  {
    id: 1,
    name: 'truck engine idle',
    properties: {
      resource: 'resource1',
      metric: 'door_open',
      condition: '>',
      value: '15'
    },
    target: [2]
  },
  {
    id: 2,
    name: 'truck standing still',
    properties: {
      resource: 'resource1',
      metric: 'engine_status',
      condition: '==',
      value: 'true'
    },
    target: [3]
  },
  {
    id: 3,
    name: 'alert message',
    properties: {
      message: 'dummy message'
    }
  }
]
