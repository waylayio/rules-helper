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
  const { playbook } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN })

  const templates = await playbook.getTemplates('subflow')

  // create a builder instance
  const builder = playbook.createBuilder()

  return builder
    .addStep(templates[0])
    .addStep(templates[0])
    .createTask('test playbook sdk')
}

start()
  .then(task => {
    console.log('successfully ran the example')
    console.info(task)
  })
  .catch(err => {
    if (!err.isAxiosError) {
      console.error(err)
      return
    }
    const errData = get(err, 'response.data') || get(err, 'config')
    console.error(util.inspect(errData, false, null, true))
  })
