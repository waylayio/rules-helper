const { map, pick } = require('lodash')
const memoize = require('memoizee')

const Builder = require('./builder')

const {
  PLUG_PROPERTIES
} = require('./defaults')

class Chain {
  constructor (options) {
    this.waylay = options.waylay

    this.getPlugins = memoize(this._getPlugins, { promise: true, maxAge: 60 * 1000 * 5 }) // 5 min cache
  }

  async _getPlugins () {
    const sensors = await this.waylay.sensors.list()
    const actuators = await this.waylay.actuators.list()

    return {
      sensors: map(sensors, plug => ({ ...pick(plug, PLUG_PROPERTIES), type: 'sensor' })),
      actuators: map(actuators, plug => ({ ...pick(plug, PLUG_PROPERTIES), type: 'actuator' }))
    }
  }

  createBuilder () {
    return new Builder({ waylay: this.waylay })
  }
}

module.exports = Chain
