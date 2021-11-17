const TASK_DEFAULT = {
  sensors: [],
  actuators: [],
  relations: [],
  triggers: []
}

const TASK_OPTIONS_DEFAULT = {
  type: 'periodic',
  start: true,
  pollingInterval: 900
}

const STEP_DEFAULTS = {
  dataTrigger: true,
  tickTrigger: false
}

const PLUG_PROPERTIES = ['name', 'version', 'category', 'iconURL', 'description', 'configuration', 'states']

module.exports = {
  TASK_DEFAULT,
  TASK_OPTIONS_DEFAULT,
  STEP_DEFAULTS,
  PLUG_PROPERTIES
}
