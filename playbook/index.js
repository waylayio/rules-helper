const { map } = require('lodash')
const memoize = require('memoizee')

const Builder = require('./builder')

class Chain {
  constructor (options) {
    this.waylay = options.waylay

    this.getTemplates = memoize(this._getTemplates, { promise: true, maxAge: 60 * 1000 * 5 }) // 5 min cache
  }

  async _getTemplates (filter) {
    const templates = await this.waylay.templates.list(filter)

    return Promise.all(map(templates, template => this.waylay.templates.get(template.name, { format: 'simplified' })))
  }

  createBuilder () {
    return new Builder({ waylay: this.waylay })
  }
}

module.exports = Chain
