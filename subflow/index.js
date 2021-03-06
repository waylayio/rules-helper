const { reduce, isEmpty, map, find, last, first, includes, chain, forEach, get, pick, startsWith, endsWith, isArray, findLastIndex, filter, some, every, uniqBy } = require('lodash')
const Ajv = require('ajv')
const Mustache = require('mustache')

const { extractPlugins, addRandomPosition, addLabelsToPlugins } = require('./helper')
const Builder = require('./builder')

const defaultConfig = require('./default.config')

// disable mustache escaping functionality
Mustache.escape = (text) => text
Mustache.tags = ['<%', '%>']

const validate = new Ajv({ allowUnionTypes: true })

const validationSchemas = {}

const validateConfigCompiled = validate.compile(require('./config.schema'))
const validateStepsCompiled = validate.compile(require('./step.schema'))

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

  async _preSave (taskDefinition) {
    await this._validateTask(taskDefinition)

    const { steps } = taskDefinition

    const enhancedSteps = this._addPluginsToSteps(steps)

    // link the wrapped plugins internally to each other
    const pluginTriggers = this._createPluginTriggers(enhancedSteps)

    // link steps together
    const stepTriggers = this._createStepTriggers(enhancedSteps)

    // create gate relationships
    const stepRelations = this._createGateRelationships(enhancedSteps)

    const { sensors, actuators } = extractPlugins(enhancedSteps)

    return {
      sensors,
      actuators,
      relations: stepRelations,
      triggers: [...pluginTriggers, ...stepTriggers]
    }
  }

  async createTask (taskDefinition, options) {
    const parsedDefinition = await this._preSave(taskDefinition)

    const { name } = taskDefinition

    const task = {
      ...parsedDefinition,
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

  async createTemplate (taskDefinition) {
    const parsedDefinition = await this._preSave(taskDefinition)

    const { name } = taskDefinition

    const task = {
      ...parsedDefinition,
      name
    }

    return this.waylay.templates.create(task)
  }

  getSubflows (query, config) {
    let pluginsToUse = config || this.config

    if (!isEmpty(query)) {
      const { AND = [], OR = [] } = query

      if (!isArray(AND) || !isArray(OR)) throw new Error('AND / OR query should be an array of strings')

      const orPlugins = filter(this.config, config => {
        if (isEmpty(config.tags)) return false
        return some(OR, tagToCheck => {
          return includes(config.tags || [], tagToCheck)
        })
      })

      // lodash every returns true if you check agains empty array so need to make sure we don't filter when no AND is supplied
      const andPlugins = isEmpty(AND)
        ? []
        : filter(this.config, config => {
          if (isEmpty(config.tags)) return false
          return every(AND, tagToCheck => {
            return includes(config.tags || [], tagToCheck)
          })
        })

      pluginsToUse = uniqBy([...orPlugins, ...andPlugins], plugin => plugin.name)
    }

    return map(pluginsToUse, config => {
      return pick(config, ['name', 'description', 'properties', 'tags'])
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

    const isValid = validateStepsCompiled(steps)
    const { errors } = validateStepsCompiled

    if (!isValid && !isEmpty(errors)) {
      const errorsParsed = map(errors, ({ message, instancePath }) => `${instancePath} ${message}`)
      throw new Error(`steps validation failed ${errorsParsed}`)
    }

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

  _validateGraph (steps) {
    chain(steps)
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

      // spread don't push! else the mutation will break the recursive check
      children = [...children, id]

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

      if (!isValid && !isEmpty(errors)) acc = [...acc, ...map(errors, ({ message, instancePath }) => `step ${id} validation failed: properties ${instancePath} ${message}`)]

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

      return [...updatedPlugins, {
        ...this._templateObject(plugin, context, configProperties),
        properties: this._templateObject(pluginProperties, context, configProperties)
      }]
    }, [])
  }

  _templateObject (object, context, configProperties) {
    return reduce(object, (acc, val, key) => {
      let newVal = typeof val === 'string' ? Mustache.render(val, context) : val

      const isParseable = startsWith(val, '<%') && endsWith(val, '%>')

      if (isParseable) {
        const valueName = val.replace('<%', '').replace('%>', '').replace('properties.', '')
        const parsingType = get(configProperties, `${valueName}.type`)
        if (!isArray(parsingType)) {
          switch (parsingType) {
            case 'number': {
              newVal = Number(newVal)
              break
            }
            case 'object': {
              newVal = get(context, `properties.${valueName}`, newVal)
              break
            }
            default: break
          }
        }
      }

      acc[key] = newVal

      return acc
    }, {})
  }
}

module.exports = Subflow
