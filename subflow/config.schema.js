const baseProperties = {
  name: { type: 'string' },
  version: { type: 'string' },
  type: {
    type: 'string',
    enum: ['sensor', 'actuator']
  },
  properties: { type: 'object' }
}

const plugins = {
  type: 'array',
  items: {
    type: 'object',
    properties: baseProperties,
    required: ['name', 'version', 'type'],
    if: {
      properties: {
        type: { const: 'sensor' }
      },
      required: ['type']
    },
    then: {
      properties: {
        ...baseProperties,
        dataTrigger: { type: 'boolean' },
        tickTrigger: { type: 'boolean' },
        triggers: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      required: [
        'dataTrigger',
        'tickTrigger',
        'triggers'
      ],
      additionalProperties: false
    },
    else: {
      properties: baseProperties,
      additionalProperties: false
    }
  }
}

module.exports = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      properties: { type: 'object' },
      plugins: plugins
    },
    required: ['name', 'description'],
    additionalProperties: false
  }
}
