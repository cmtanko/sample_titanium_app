const AWS = require('aws-sdk')
const qs = require('querystring')
const ecs = new AWS.ECS()

const {
  sendResponse,
  sendSlackMessage,
  getResponseMenu,
  getHelpMenu,
  getHelpString,
  sendJenkinsJob
} = require('./responseService')

const { AVAILABLE_COMMANDS } = require('./config')

AWS.config.update({ region: 'ap-southeast-2' })

exports.handler = async event => {
  try {
    if (event && event.body && event.body.length > 0) {
      const body = Buffer.from(event.body, 'base64').toString('utf8')
      const params = qs.parse(body)

      if (params && params.payload && params.payload.trim().length > 0) {
        console.warn('Deprovisioning site...')
        console.warn(JSON.parse(params.payload))
        let parsedPayload = JSON.parse(params.payload)

        if (parsedPayload.type === 'block_actions') {
          console.warn('Initiating Jenkins job...')
          await sendSlackMessage({
            text:
              'Initiating Jenkins job.....,\nCheck #deprovision-sites channel for status *'
          })
          await sendJenkinsJob(parsedPayload)
          return sendResponse(200, 'Initiating Jenkins job.....*')
        }
      } else if (params && params.text && params.text.trim().length > 0) {
        const text = params.text.toLowerCase().split(' ')
        const command = AVAILABLE_COMMANDS[text[0]]

        let arg1 = text[1] && text[1].toString().toLowerCase()
        let arg2 = text[2] && text[2].toString().toLowerCase()

        console.warn({ text, command, arg1, arg2 })

        switch (command) {
          case AVAILABLE_COMMANDS.list:
            console.warn('Listing running services...')

            const data = await ecs
              .listServices({ cluster: 'integral-staging-Cluster' })
              .promise()

            await sendSlackMessage(getResponseMenu(data))
            return sendResponse(200, '*Listing running services...*')
          case AVAILABLE_COMMANDS.help:
            await sendSlackMessage(getHelpMenu())
            return sendResponse(200, '*Getting help*')
          default:
            return sendResponse(
              200,
              getHelpString(),
              false
            )
        }
      } else {
        return sendResponse(
          200,
          getHelpString(),
          false
        )
      }
    }
  } catch (error) {
    console.warn(error)
    return sendResponse(500, `Error: ${error.message}`)
  }
}
