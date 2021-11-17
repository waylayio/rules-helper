const plugins = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      type: {
        type: 'string',
        enum: ['sensor', 'actuator']
      },
      properties: { type: 'object' },
      dataTrigger: { type: 'boolean' },
      tickTrigger: { type: 'boolean' },
      triggers: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    },
    required: ['name', 'version', 'type'],
    additionalProperties: false
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
