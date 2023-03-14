const axios = require('axios')
const qs = require('querystring')

const JENKINS_URL = process.env.JENKINS_URL
const JENKINS_AUTH_TOKEN = process.env.JENKINS_AUTH_TOKEN
const SLACK_INCOMING_HOOK = process.env.SLACK_INCOMING_HOOK

const sendResponse = async (statusCode, message, stringify = true) => ({
  statusCode,
  body: stringify ? JSON.stringify(message) : message
})

const sendSlackMessage = async (message = 'test') => {
  const SLACK_INCOMING_HOOK = process.env.SLACK_INCOMING_HOOK
  console.log('Sending Slack Message')
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: SLACK_INCOMING_HOOK,
    headers: {
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(message)
  }

  try {
    const response = await axios(config)
    console.warn({ response })
    return response
  } catch (error) {
    console.log('Error sending Slack message: ', error)
    return error
  }
}

const getResponseMenu = data => {
  console.log('Getting response menu')
  const output = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Currently running staging sites:*'
      }
    },
    ...data.serviceArns.map(serviceArn => {
      const [, , , , , serviceName] = serviceArn.split(':')
      const [, , siteName] = serviceName.split('/')
      const [siteClientName] = siteName.split('-')
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:large_green_circle: *${siteName}*`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            emoji: true,
            text: 'Deprovision'
          },
          value: siteClientName
        }
      }
    })
  ]
  return { blocks: output }
}

const sendJenkinsJob = async parsedPayload => {
  let data = qs.stringify({
    DEPLOYMENT_ENV: 'staging',
    SITE_NAME: parsedPayload.actions[0].value,
    USER_NAME: parsedPayload.user.username
  })

  let jenkinsConfig = {
    method: 'post',
    maxBodyLength: Infinity,
    url: JENKINS_URL,
    headers: {
      Authorization: `Basic ${JENKINS_AUTH_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: data
  }

  let result =  await axios(jenkinsConfig)
  return result
}

const getHelpMenu = () => {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*/cevo [Command] [arg1]* \n\n'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*<https://integralcs.atlassian.net/wiki/spaces/DEVOPS/pages/2919530497/Cevo+How+to| How to \\cevo>*\nCevo is a Slack slash command bot that helps to provision and de-provision through Slack.'
        },
        accessory: {
          type: 'image',
          image_url:
            'https://avatars.slack-edge.com/2023-03-13/4929929773879_a5440936038d485c9d9e_72.jpg',
          alt_text: 'cevo bot'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Command:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*list* List all currently staged sites'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*help* Get help'
        }
      }
    ]
  }
}

const getHelpString = () => {
  return `> /cevo [Command] [arg1] \n\n
  *Command:* \n
  list : \t   _List all currently provisioned sites_ \n
  help : \t   _Get help_ \n`
}

module.exports = {
  getHelpMenu,
  sendResponse,
  getHelpString,
  sendJenkinsJob,
  getResponseMenu,
  sendSlackMessage
}
