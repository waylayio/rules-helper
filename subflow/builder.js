const { isEmpty, last, dropRight, map, includes } = require('lodash')
const { checkIfObjectHasRequiredKeys } = require('./helper')
const { v4: uuid } = require('uuid')

class Builder {
  constructor (options, client) {
    checkIfObjectHasRequiredKeys(['name'])

    const { name } = options

    this.name = name

    this.steps = []

    this.client = client
  }

  addStep (step) {
    checkIfObjectHasRequiredKeys(step, ['name', 'properties'])
    const { name } = step

    const configStep = this.client._findStepInConfig(name)

    if (!configStep) throw new Error(`no step setup in config with name ${name}`)

    const newStep = { ...step, id: uuid() }

    const prevStep = last(this.steps)

    // ! mutates !
    if (!isEmpty(prevStep)) prevStep.target = [newStep.id]

    const newSteps = [...this.steps, newStep]

    this.client._validateStepProperties(newSteps)

    this.steps = newSteps
  }

  removeStep () {
    const stepToRemove = last(this.steps)

    // spread so we don't mutate
    this.steps = dropRight([...this.steps])

    if (isEmpty(this.steps)) return

    // watch out, mutation!
    this.steps = map([...this.steps], step => {
      return includes(step.target, stepToRemove.id)
        ? { ...step, target: [] }
        : step
    })
  }

  getSteps () {
    return this.steps
  }

  async createTask () {
    return this.client.createTask({
      name: this.name,
      steps: this.steps
    })
  }
}

module.exports = Builder
