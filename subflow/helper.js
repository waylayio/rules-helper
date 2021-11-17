const { reduce, groupBy, random, map, isEmpty } = require('lodash')

function extractPlugins (steps) {
  return reduce(steps, (acc, step) => {
    const { plugins } = step
    const { sensors = [], actuators = [] } = acc
    const { sensor: newSensors = [], actuator: newActuators = [] } = groupBy(plugins, 'type')

    return {
      sensors: [...sensors, ...newSensors],
      actuators: [...actuators, ...newActuators]
    }
  }, {})
}

function addRandomPosition (plugin) {
  return {
    ...plugin,
    position: [random(100, 1250), random(100, 500)]
  }
}

function addLabelsToPlugins (plugins, id) {
  return map(plugins, plugin => ({
    ...plugin,
    label: `${plugin.name}_${id}`
  }))
}

function checkIfObjectHasRequiredKeys (properties, required) {
  const missingProperties = reduce(required, (acc, property) => isEmpty(properties[property]) ? [...acc, property] : acc, [])

  if (!isEmpty(missingProperties)) throw Error(`missing certain properties ${missingProperties}`)
}

module.exports = {
  extractPlugins,
  addRandomPosition,
  addLabelsToPlugins,
  checkIfObjectHasRequiredKeys
}
