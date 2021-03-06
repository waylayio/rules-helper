const { get } = require('lodash')
const util = require('util')

const Helper = require('../../index')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  DOMAIN
} = process.env

async function start () {
  // init the sdk with a waylay API key, secret and domain
  const { chain } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN })

  // create a builder instance
  const builder = chain.createBuilder()

  // all sensors and actuators can be fetched through this function
  // const { sensors, actuators } = await client.getPlugins()

  builder
    .addStep({
      name: 'inRange',
      type: 'sensor',
      version: '1.0.2',
      properties: {
        value: '${task.streamData}' //eslint-disable-line
      },
      states: ['Above', 'In Range'],
      dataTrigger: true,
      tickTrigger: true
    })
    .addAndGate([
      {
        name: 'inRange',
        type: 'sensor',
        version: '1.0.2',
        properties: {
          value: '${task.streamData}' //eslint-disable-line
        },
        states: ['Above'],
        dataTrigger: true,
        tickTrigger: true
      },
      {
        name: 'inRange',
        type: 'sensor',
        version: '1.0.2',
        properties: {
          value: '${task.streamData}' //eslint-disable-line
        },
        states: ['In Range'],
        dataTrigger: true,
        tickTrigger: true
      }
    ])
    .addStep({
      name: 'mandrillMail',
      type: 'sensor',
      version: '1.1.1',
      properties: {
        from: 'test@waylay.io',
        to: 'veselin@waylay.io'
      },
      dataTrigger: true,
      tickTrigger: true
    })

  // addOrGate and addAndGate is also available which takes an array of steps which will be connected to the gate

  // when finished use this function to create the task on the domain with a name, second object are task properties
  return builder.createTask('test sdk builder', {})
}

start()
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
