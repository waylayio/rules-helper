const { map, dropRight, isArray, forEach, last, isEmpty, reduce, castArray, isNil, flatten } = require('lodash')

const {
  STEP_DEFAULTS,
  TASK_OPTIONS_DEFAULT,
  TASK_DEFAULT
} = require('./defaults')

const {
  stepSchema
} = require('./schemas')

const {
  validateWithSchema
} = require('./helper')

class Builder {
  constructor (options) {
    this.waylay = options.waylay
    this.steps = []
  }

  addStep (step) {
    if (isArray(step)) throw new Error('to push multiple steps please use the addAndGate or addOrGate')
    this._validateStep(step)
    this.steps.push({ ...(step.type === 'actuator' ? {} : STEP_DEFAULTS), label: `${step.name}_${this.steps.length}`, ...step })

    return this
  }

  addOrGate (steps) {
    if (!isArray(steps)) throw new Error('please provide an array of steps')
    forEach(steps, this._validateStep)
    this.steps.push(map(steps, (step, index) => ({ ...(step.type === 'actuator' ? {} : STEP_DEFAULTS), label: `${step.name}_${this.steps.length}_${index}`, ...step })))
    this.steps.push({ type: 'gate', name: 'OR', label: `OR_${this.steps.length}`, states: ['TRUE'] })

    return this
  }

  addAndGate (steps) {
    if (!isArray(steps)) throw new Error('please provide an array of steps')
    forEach(steps, this._validateStep)
    this.steps.push(map(steps, (step, index) => ({ ...(step.type === 'actuator' ? {} : STEP_DEFAULTS), label: `${step.name}_${this.steps.length}_${index}`, ...step })))
    this.steps.push({ type: 'gate', name: 'AND', label: `AND_${this.steps.length}`, states: ['TRUE'] })

    return this
  }

  removeStep () {
    const stepToRemove = last(this.steps)

    if (isEmpty(stepToRemove)) return

    if (stepToRemove.name === 'gate') {
      // remove the gate and the steps before it
      this.steps = dropRight([...this.steps])
      this.steps = dropRight([...this.steps])
      return
    }

    this.steps = dropRight([...this.steps])

    return this
  }

  async createTask (name, options) {
    const position = [-100, 0]

    const task = reduce(this.steps, (acc, step, index) => {
      const { sensors, actuators, triggers, relations } = acc

      position[1] = 150

      forEach(castArray(step), (step, stepIndex) => {
        const { name, version, properties, dataTrigger, tickTrigger, type, label } = step

        stepIndex === 0 ? position[0] = position[0] + 250 : position[1] = position[1] + 150

        switch (type) {
          case 'sensor': {
            sensors.push({ name, version, properties, dataTrigger, tickTrigger, label, position: [...position] })
            break
          }
          case 'actuator': {
            actuators.push({ name, version, properties, dataTrigger, tickTrigger, label, position: [...position] })
            break
          }
          case 'gate': {
            const stepsForGate = this.steps[index - 1]

            if (!isArray(stepsForGate) || isEmpty(stepsForGate)) return

            relations.push({
              label,
              type: name,
              parentLabels: map(stepsForGate, step => step.label),
              combinations: [flatten(map(stepsForGate, step => step.states))],
              position: [...position]
            })

            return
          }
        }

        const previousStep = this.steps[index - 1]

        if (!isNil(previousStep)) {
          const { states } = previousStep

          triggers.push({
            sourceLabel: previousStep.label,
            destinationLabel: label,
            statesTrigger: states
          })
        }
      })

      return acc
    }, { ...TASK_DEFAULT })

    return this.waylay.tasks.create({
      ...task,
      task: {
        ...TASK_OPTIONS_DEFAULT,
        name,
        ...options
      }
    })
  }

  _validateStep (step) {
    return validateWithSchema(stepSchema, step)
  }
}

module.exports = Builder
