const stepSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    label: { type: 'string' },
    type: {
      type: 'string',
      enum: ['sensor', 'actuator']
    },
    properties: { type: 'object' },
    states: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    dataTrigger: {
      type: 'boolean'
    },
    tickTrigger: {
      type: 'boolean'
    }
  },
  required: ['name', 'version', 'type', 'properties'],
  additionalProperties: false
}

module.exports = {
  stepSchema
}
