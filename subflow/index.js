const { reduce, isEmpty, map, find, last, first, includes, filter, chain, forEach, get, pick, startsWith, endsWith, isArray, findLastIndex } = require('lodash')
const Ajv = require('ajv')
const Mustache = require('mustache')

const { extractPlugins, addRandomPosition, addLabelsToPlugins } = require('./helper')
const Builder = require('./builder')

const defaultConfig = require('./default.config')

// disable mustache escaping functionality
Mustache.escape = (text) => text
Mustache.tags = ['<%', '%>']

const validate = new Ajv()

const validationSchemas = {}

const validateConfigCompiled = validate.compile(require('./config.schema'))

class Subflow {
  constructor (options) {
    this._validateConfig(options.config)

    const { config, waylay } = options

    this.waylay = waylay

    this.config = [...defaultConfig, ...config] || {}
    this.builderConfig = [...config] || {}
  }

  createTaskBuilder () {
    return new Builder(this)
  }

  async createTask (taskDefinition, options) {
    await this._validateTask(taskDefinition)

    const { steps, name } = taskDefinition

    const enhancedSteps = this._addPluginsToSteps(steps)

    // link the wrapped plugins internally to each other
    const pluginTriggers = this._createPluginTriggers(enhancedSteps)

    // link steps together
    const stepTriggers = this._createStepTriggers(enhancedSteps)

    // create gate relationships
    const stepRelations = this._createGateRelationships(enhancedSteps)

    const { sensors, actuators } = extractPlugins(enhancedSteps)

    const task = {
      sensors,
      actuators,
      relations: stepRelations,
      triggers: [...pluginTriggers, ...stepTriggers],
      task: {
        type: 'periodic',
        start: true,
        name: name,
        pollingInterval: 900,
        ...options
      }
    }

    return this.waylay.tasks.create(task)
  }

  getPlugins () {
    return map(this.config, config => {
      return pick(config, ['name', 'description', 'properties'])
    })
  }

  _validateConfig (config) {
    const isValid = validateConfigCompiled(config)
    const { errors } = validateConfigCompiled

    if (!isValid && !isEmpty(errors)) {
      const errorsParsed = map(errors, ({ message, instancePath }) => `${instancePath} ${message}`)
      throw new Error(`config validation failed ${errorsParsed}`)
    }

    // check if all wrapped plugins are from the same type
    const pluginTypeErrors = reduce(config, (acc, plugin) => {
      const { plugins, name } = plugin
      const allTypes = chain(plugins)
        .map(plugin => plugin.type)
        .uniq()
        .value()

      if (allTypes.length > 1) acc.push(`plugin ${name} has different plugin types ${allTypes} only one type is allowed per plugin`)

      return acc
    }, [])

    if (!isEmpty(pluginTypeErrors)) throw Error(`failed to validate config: ${pluginTypeErrors}`)

    // check if all wrapped plugins are from the same type
    const pluginStreamErrors = reduce(config, (acc, plugin) => {
      const { plugins, name } = plugin
      const streamIndex = findLastIndex(plugins, plugin => plugin.dataTrigger === true)

      if (streamIndex > 0) acc.push(`plugin ${name} cannot have a stream sensor other then in the first position`)

      return acc
    }, [])

    if (!isEmpty(pluginStreamErrors)) throw Error(`failed to validate config: ${pluginStreamErrors}`)
  }

  async _validateTask (task) {
    const { steps } = task

    this._validateStepConfig(steps)

    this._validateStepTargets(steps)

    // add config definition to the steps
    const stepsWithPlugins = this._addPluginsToSteps(steps)

    this._validateGraph(stepsWithPlugins)

    // check if the passed properties match the schema
    this._validateStepProperties(stepsWithPlugins)
  }

  // check if every passed step has a config
  _validateStepConfig (steps) {
    const missingConfig = reduce(steps, (acc, { name }) => {
      const foundConfig = this._findStepInConfig(name)

      if (!foundConfig) acc.push(name)

      return acc
    }, [])

    if (!isEmpty(missingConfig)) throw new Error(`missing config for step ${missingConfig}`)
  }

  _validateStepTargets (steps) {
    const errors = reduce(steps, (acc, step) => {
      const { target, id } = step
      forEach(target, targetId => {
        const targetExists = find(steps, ({ id }) => id === targetId)
        if (!targetExists) acc = [...acc, `step ${id} has a target ${targetId} that doesn't exist`]
      })
      return acc
    }, [])

    if (!isEmpty(errors)) throw new Error(`failed to validate step targets: ${errors}`)
  }

  /**
   * only thing we are sure of during circular dependency check is that a leaf has no targets
   * we can't assume we can start with the step where nobody points to because what if the circular dependency starts at that step
   * example: 1 - 2 - 3 - 4 - 5 => here every node has a parent
   * |_______________|
   * example: 1 - 2 - 3 - 4 - 5 => here taking the node nobody points to would result in us starting and stopping at 5
   * |___________|
  **/
  _validateGraph (steps) {
    const leafNodes = filter(steps, step => isEmpty(step.target))

    if (isEmpty(leafNodes)) throw new Error('at least one node without a target required')

    chain(leafNodes)
      .map(({ id }) => validateStep(id))
      .flatten()
      .value()

    // parents of a step are all steps which have this step as a target
    function getParents (id) {
      return reduce(steps, (acc, { id: targetId, target = [] }) => {
        return includes(target, id)
          ? [...acc, targetId]
          : acc
      }, [])
    }

    function lookupStep (id) {
      return find(steps, step => step.id === id)
    }

    function validateStep (id, children = []) {
      // get all parents from this step
      const parents = getParents(id)

      // when empty just return the children
      if (isEmpty(parents)) return children

      const step = lookupStep(id)
      const { plugins } = step

      // gates can only have one plugin setup
      const isGate = get(first(plugins), 'type', '') === 'gate'

      // only gates can have multiple steps pointing at them
      if (parents.length > 1 && !isGate) throw new Error('only gates can have more then 1 step pointing to them')

      // spread don't push! else the mutation will break the recursive check
      children = [...children, id]

      // go over the parents and see if they were already verified as children
      forEach(parents, parentId => {
        // parent is already in the list as a child, this indicates circular dependency
        const parentAlreadyInList = find(children, childId => childId === parentId)
        if (parentAlreadyInList) {
          // lookup the circular dependency step, this is both parent and child
          const parentStep = lookupStep(parentId)
          // lookup the current step to which the circular dependency goes
          const currentStep = lookupStep(id)
          throw new Error(`circular dependency detected from ${parentStep.id} to ${currentStep.id}`)
        }
      })

      // go over each parent passing it the current child list
      return chain(parents)
        .map(parentId => validateStep(parentId, children))
        .flatten()
        .value()
    }
  }

  _validateStepProperties (steps) {
    const validationErrors = reduce(steps, (acc, step) => {
      const { name, properties, id } = step

      const config = this._findStepInConfig(name)
      const { properties: configProperties } = config

      if (isEmpty(configProperties)) return acc

      let validateF = validationSchemas[name]

      if (!validateF) {
        validationSchemas[name] = validate.compile({
          type: 'object',
          properties: configProperties,
          required: Object.keys(configProperties)
        })

        validateF = validationSchemas[name]
      }

      const isValid = validateF(properties)

      const { errors } = validateF

      if (!isValid && !isEmpty(errors)) acc = [...acc, ...map(errors, ({ message, instancePath }) => `step ${id} validation failed: properties${instancePath} ${message}`)]

      return acc
    }, [])

    if (!isEmpty(validationErrors)) throw new Error(validationErrors)
  }

  _findStepInConfig (name) {
    return find(this.config, ({ name: configName }) => configName === name)
  }

  _addPluginsToSteps (steps) {
    return map(steps, (step) => {
      const { name, id, properties } = step

      const definition = this._findStepInConfig(name)

      const { plugins } = definition

      // add unique labels to the step
      const pluginsWithLabels = addLabelsToPlugins(plugins, id)

      const pluginsWithValues = this._fillInTemplateValues({ ...step, plugins: pluginsWithLabels }, properties)

      const pluginsWithCoordinates = map(pluginsWithValues, addRandomPosition)

      return {
        ...step,
        plugins: pluginsWithCoordinates
      }
    })
  }

  _createPluginTriggers (steps) {
    return reduce(steps, (triggers, step) => {
      const { plugins } = step
      reduce(plugins, (acc, plugin, index) => {
        if (isEmpty(acc)) return [plugin]
        triggers = [...triggers, {
          sourceLabel: acc[index - 1].label,
          destinationLabel: plugin.label,
          statesTrigger: acc[index - 1].triggers
        }]
      }, [])
      return triggers
    }, [])
  }

  _createStepTriggers (steps) {
    return reduce(steps, (triggers, step) => {
      const { target, plugins } = step

      const sourcePlugin = last(plugins)
      const { label: sourceLabel, triggers: sourceTriggers } = sourcePlugin

      map(target, (targetId) => {
        const resolvedTarget = find(steps, ({ id }) => id === targetId)

        const { plugins } = resolvedTarget

        const { label: destinationLabel, type: destinationType } = first(plugins)

        if (destinationType === 'gate') return

        triggers = [...triggers, {
          sourceLabel,
          destinationLabel,
          statesTrigger: sourceTriggers
        }]
      })

      return triggers
    }, [])
  }

  _createGateRelationships (steps) {
    return reduce(steps, (relations, step) => {
      const { target, plugins } = step

      const sourcePlugin = last(plugins)
      const { label: sourceLabel, triggers: sourceTriggers } = sourcePlugin

      map(target, (targetId) => {
        const resolvedTarget = find(steps, ({ id }) => id === targetId)

        if (!resolvedTarget) throw new Error(`target ${targetId} does not exist`)

        const { plugins } = resolvedTarget

        const { label: destinationLabel, type: destinationType } = first(plugins)

        if (destinationType !== 'gate') return

        const existingRelation = find(relations, relation => relation.label === destinationLabel)

        if (existingRelation) {
          existingRelation.parentLabels.push(sourceLabel)
          existingRelation.combinations[0].push(...sourceTriggers)
          return
        }

        relations = [...relations, addRandomPosition({
          label: destinationLabel,
          type: first(plugins).name,
          parentLabels: [sourceLabel],
          combinations: [[...sourceTriggers]]
        })]
      })

      return relations
    }, [])
  }

  _fillInTemplateValues (step) {
    const { plugins, properties: stepProperties, name: stepName } = step
    return reduce(plugins, (updatedPlugins, plugin, index) => {
      const { properties: pluginProperties } = plugin

      const { properties: configProperties } = find(this.config, config => config.name === stepName)

      if (isEmpty(pluginProperties)) return [...updatedPlugins, plugin]

      let context = {
        properties: stepProperties
      }

      const previousPlugin = updatedPlugins[index - 1]

      if (previousPlugin) {
        context = {
          ...context,
          previousNode: `nodes.${previousPlugin.label}`
        }
      }

      const templatedProperties = reduce(pluginProperties, (acc, val, key) => {
        let newVal = Mustache.render(val, context)
        const isParseable = startsWith(val, '<%') && endsWith(val, '%>')

        if (isParseable) {
          const parsingType = get(configProperties, `${val.replace('<%', '').replace('%>', '').replace('properties.', '')}.type`)

          if (!isArray(parsingType)) {
            switch (parsingType) {
              case 'number': {
                newVal = Number(newVal)
                break
              }
              default: break
            }
          }
        }

        acc[key] = newVal
        return acc
      }, {})

      return [...updatedPlugins, {
        ...plugin,
        properties: templatedProperties
      }]
    }, [])
  }
}

module.exports = Subflow
