const { last, reduce, first, map } = require('lodash')

const TASK_OPTIONS_DEFAULT = {
  type: 'periodic',
  start: true,
  pollingInterval: 900
}

class Builder {
  constructor (options) {
    this.waylay = options.waylay
    this.steps = []
  }

  addStep (template) {
    this.steps.push({ type: 'template', value: template })
    return this
  }

  _parseTemplate (template, prefix, offset) {
    const { sensors = [], actuators = [], relations = [], triggers = [] } = template

    const newSensors = map(sensors, sensor => {
      return {
        ...sensor,
        label: `${prefix}_${sensor.label}`,
        position: [sensor.position[0], sensor.position[1] + offset]
      }
    })

    const newActuators = map(actuators, actuator => {
      return {
        ...actuator,
        label: `${prefix}_${actuator.label}`,
        position: [actuator.position[0], actuator.position[1] + offset]
      }
    })

    const newRelations = map(relations, relation => {
      return {
        ...relation,
        label: `${prefix}_${relation.label}`,
        parentLabels: map(relation.parentLabels, parentLabel => `${prefix}_${parentLabel}`),
        position: [relation.position[0], relation.position[1] + offset]
      }
    })

    const newTriggers = map(triggers, trigger => {
      return {
        ...trigger,
        sourceLabel: `${prefix}_${trigger.sourceLabel}`,
        destinationLabel: `${prefix}_${trigger.destinationLabel}`
      }
    })

    return {
      sensors: newSensors,
      actuators: newActuators,
      relations: newRelations,
      triggers: newTriggers
    }
  }

  async _preSave () {
    return reduce(this.steps, async (acc, step, index) => {
      acc = await acc
      const { value } = step
      const { sensors = [], actuators = [], relations = [], triggers = [] } = this._parseTemplate(value, index, index * 250)

      if (index !== 0) {
        const sourceSensor = last(acc.sensors)
        const destinationSensor = first(sensors)
        const fullSensor = await this.waylay.sensors.get(sourceSensor.name, sourceSensor.version)

        acc.triggers.push({
          sourceLabel: sourceSensor.label,
          destinationLabel: '1_stream_0',
          statesTrigger: [fullSensor.states[0]]
        })
      }

      acc.sensors.push(...sensors)
      acc.actuators.push(...actuators)
      acc.relations.push(...relations)
      acc.triggers.push(...triggers)

      return acc
    }, {
      sensors: [],
      actuators: [],
      relations: [],
      triggers: []
    })
  }

  async createTask (name, options) {
    const parsedDefinition = await this._preSave()
    const foo = {
      ...parsedDefinition,
      task: {
        ...TASK_OPTIONS_DEFAULT,
        name,
        ...options
      }
    }
    debugger
    return this.waylay.tasks.create({
      ...parsedDefinition,
      task: {
        ...TASK_OPTIONS_DEFAULT,
        name,
        ...options
      }
    })
  }
}

module.exports = Builder
