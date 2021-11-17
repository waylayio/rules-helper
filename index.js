const Waylay = require('@waylay/client')
const { reduce, isEmpty } = require('lodash')

const Chain = require('./chain')
const Subflow = require('./subflow')

const REQUIRED_PROPERTIES = ['domain', 'clientID', 'secret']

class Helper {
  constructor (options) {
    const missingProperties = reduce(REQUIRED_PROPERTIES, (acc, property) => isEmpty(options[property]) ? [...acc, property] : acc, [])

    if (!isEmpty(missingProperties)) throw Error(`missing certain properties ${missingProperties}`)

    const { domain, clientID, secret, config = {} } = options

    const waylay = new Waylay({
      domain,
      clientID,
      secret
    })

    this.chain = new Chain({ waylay })

    if (!isEmpty(config)) {
      this.subflow = new Subflow({ waylay, config })
    }
  }
}

module.exports = Helper
