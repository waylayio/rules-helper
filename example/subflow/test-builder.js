const util = require('util')
const { get } = require('lodash')

const exampleConfig = require('./config')
const Helper = require('../../index')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  DOMAIN
} = process.env

async function test () {
  const { subflow } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN, config: exampleConfig })
  const builder = subflow.createTaskBuilder()

  const dummyStepStream = {
    name: 'exit geofence',
    properties: {
      resource: 'test resource'
    }
  }

  const dummyStep = {
    name: 'truck standing still',
    properties: {
      resource: 'test resource'
    }
  }

  const dummyActuator = {
    name: 'alert message',
    properties: {
      message: 'test 123'
    }
  }

  builder.addStep(dummyStepStream)
  builder.addAndGate([dummyStep, dummyStep])
  // builder.removeStep()
  builder.addStep(dummyActuator)

  return builder.createTask('subflow builder example test', {})
}

test()
  .then(task => {
    console.log('successfully ran the example')
    console.info(util.inspect(task, false, null, true))
  })
  .catch(err => {
    if (!err.isAxiosError) {
      console.error(err)
      return
    }
    const errData = get(err, 'response.data') || get(err, 'config')
    console.error(util.inspect(errData, false, null, true))
  })
