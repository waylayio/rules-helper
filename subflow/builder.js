const { isEmpty, last, dropRight, map, includes, isArray, forEach, filter } = require('lodash')
const { checkIfObjectHasRequiredKeys } = require('./helper')
const uniqid = require('uniqid')

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

    const newStep = { ...step, id: uniqid() }

    const prevStep = last(this.steps)

    // ! mutates !
    if (!isEmpty(prevStep)) prevStep.target = [newStep.id]

    const updatedSteps = [...this.steps, newStep]

    this.client._validateStepProperties(updatedSteps)

    this.steps = updatedSteps

    return this
  }

  addAndGate (steps) {
    this._addGate(steps, 'AND')
    return this
  }

  addOrGate (steps) {
    this._addGate(steps, 'OR')
    return this
  }

  _addGate (steps, type) {
    const prevStep = last(this.steps)
    const andGate = { name: type, id: uniqid() }
    const newSteps = map(steps, step => {
      this._validateStep(step)
      const newStep = { ...step, id: uniqid(), target: [andGate.id] }
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

    return this
  }

  getSteps () {
    return this.steps
  }

  getSubflows (query) {
    return this.client.getSubflows(query, this.client.builderConfig)
  }

  async createTask (name, options) {
    return this.client.createTask({
      name: name,
      steps: this.steps
    }, options)
  }

  async createTemplate (name) {
    return this.client.createTemplate({
      name: name,
      steps: this.steps
    })
  }

  _validateStep (step) {
    checkIfObjectHasRequiredKeys(step, ['name', 'properties'])
  }
}

module.exports = Builder
