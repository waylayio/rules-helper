const crypto = require('crypto')
const ajv = new (require('ajv'))()
const { isEmpty, map } = require('lodash')

const compiledSchemas = {}

function validateWithSchema (schema, object) {
  const schemaHash = crypto.createHash('md5').update(JSON.stringify(schema)).digest('hex')

  if (!compiledSchemas[schemaHash]) {
    compiledSchemas[schemaHash] = ajv.compile(schema)
  }
  const validateFunction = compiledSchemas[schemaHash]
  const isValid = validateFunction(object)
  const { errors } = validateFunction

  if (!isValid && !isEmpty(errors)) {
    const errorsParsed = map(errors, ({ message, instancePath }) => `${instancePath} ${message}`)
    throw new Error(`validation failed ${errorsParsed}`)
  }
}

module.exports = {
  validateWithSchema
}
