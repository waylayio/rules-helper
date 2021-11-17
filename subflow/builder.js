const { isEmpty, last, dropRight, some, map, pick, includes } = require('lodash')
const { checkIfObjectHasRequiredKeys } = require('./helper')
const { v4: uuid } = require('uuid')

class Builder {
  constructor (options, SDK) {
    checkIfObjectHasRequiredKeys(['name'])

    const { name } = options

    this.name = name

    this.steps = []

    this.SDK = SDK
  }

  addStep (step) {
    checkIfObjectHasRequiredKeys(step, ['name', 'properties'])
    const { name } = step

    const configStep = this.SDK._findStepInConfig(name)

    if (!configStep) throw new Error(`no step setup in config with name ${name}`)

    let lastStep = last(this.steps) || {}

    const newStep = { ...step, id: uuid() }

    const isStreamStep = this._isStreamStep(name)

    if (isStreamStep && !isEmpty(lastStep) && !this._isStreamStep(lastStep.name)) throw new Error('can only add a stream step if the previous step is also a stream step')

    if (!isStreamStep && !isEmpty(lastStep) && this._isStreamStep(lastStep.name)) {
      const gateStep = {
        name: 'AND',
        id: uuid()
      }

      this.steps = map([...this.steps], step => ({ ...step, target: [gateStep.id] }))
      this.steps.push(gateStep)
      // overwrite last step with the newly added gate step
      lastStep = gateStep
    }

    if (!isEmpty(lastStep) && !isStreamStep) {
      // watch out, mutation!
      lastStep.target = [newStep.id]
    }

    const newSteps = [...this.steps, newStep]

    this.SDK._validateStepProperties(newSteps)

    this.steps = newSteps
  }

  _isStreamStep (name) {
    const configStep = this.SDK._findStepInConfig(name)
    return some(configStep.plugins, plugin => plugin.dataTrigger === true)
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

  getPlugins () {
    return map(this.SDK.builderConfig, config => {
      const streamStep = this._isStreamStep(config.name)
      return { ...pick(config, ['name', 'description', 'properties']), stream: streamStep }
    })
  }

  async createTask () {
    return this.SDK.createTask({
      name: this.name,
      steps: this.steps
    })
  }
}

module.exports = Builder
