const util = require('util')
const { get } = require('lodash')

const exampleConfig = require('./config')
const exampleInput = require('./input')
const Helper = require('../../index')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  DOMAIN
} = process.env

async function test () {
  const { subflow } = new Helper({ clientID: CLIENT_ID, secret: CLIENT_SECRET, domain: DOMAIN, config: exampleConfig })

  return subflow.createTask({ name: 'subflow example test', steps: exampleInput })
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
