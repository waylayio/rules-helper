module.exports = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: ['string', 'number'] },
      name: { type: 'string' },
      properties: { type: 'object' },
      target: {
        type: 'array',
        items: { type: ['string', 'number'] },
        uniqueItems: true
      }
    },
    required: ['id', 'name'],
    additionalProperties: false
  }
}
