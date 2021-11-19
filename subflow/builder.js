const { isEmpty, last, dropRight, map, includes, isArray, forEach, filter, pick } = require('lodash')
const { checkIfObjectHasRequiredKeys } = require('./helper')
const { v4: uuid } = require('uuid')

class Builder {
  constructor (client) {
    this.steps = []

    this.client = client
  }

  addStep (step) {
    this._validateStep(step)
    const { name } = step

    const configStep = this.client._findStepInConfig(name)

    if (!configStep) throw new Error(`no step setup in config with name ${name}`)

    const newStep = { ...step, id: uuid() }

    const prevStep = last(this.steps)

    // ! mutates !
    if (!isEmpty(prevStep)) prevStep.target = [newStep.id]

    const updatedSteps = [...this.steps, newStep]

    this.client._validateStepProperties(updatedSteps)

    this.steps = updatedSteps
  }

  addAndGate (steps) {
    return this._addGate(steps, 'AND')
  }

  addOrGate (steps) {
    return this._addGate(steps, 'OR')
  }

  _addGate (steps, type) {
    const prevStep = last(this.steps)
    const andGate = { name: type, id: uuid() }
    const newSteps = map(steps, step => {
      this._validateStep(step)
      const newStep = { ...step, id: uuid(), target: [andGate.id] }
      if (!isEmpty(prevStep)) prevStep.target = isArray(prevStep.target) ? prevStep.target = [...prevStep.target, newStep.id] : prevStep.target = [newStep.id]
      return newStep
    })
    const updatedSteps = [...this.steps, ...newSteps, andGate]
    this.client._validateStepProperties(updatedSteps)
    this.steps = updatedSteps
  }

  removeStep () {
    const stepToRemove = last(this.steps)

    const isGate = includes(['AND', 'OR'], stepToRemove.name)

    const gateSteps = isGate ? filter(this.steps, step => includes(step.target, stepToRemove.id)) : []

    const stepsToUnlink = [stepToRemove, ...gateSteps]

    forEach(stepsToUnlink, unlinkStep => {
      // spread so we don't mutate
      this.steps = dropRight([...this.steps])

      if (isEmpty(this.steps)) return

      // watch out, mutation!
      this.steps = map([...this.steps], step => {
        return includes(step.target, unlinkStep.id)
          ? { ...step, target: [] }
          : step
      })
    })
  }

  getSteps () {
    return this.steps
  }

  getPlugins () {
    return map(this.client.builderConfig, config => ({ ...pick(config, ['name', 'description', 'properties']) }))
  }

  async createTask (name, options) {
    return this.client.createTask({
      name: name,
      steps: this.steps
    }, options)
  }

  _validateStep (step) {
    checkIfObjectHasRequiredKeys(step, ['name', 'properties'])
  }
}

module.exports = Builder
