import http from 'http'
import axios from 'axios'
import jose from 'node-jose'

const axiosApi = axios.create({
  baseURL: 'http://credy-check-api/v1/'
})
const callback = {
  host: 'rauno-precision-5530.lan',
  port: 3001
}

let authToken

const getAuthToken = () => {
  return new Promise((resolve, reject) => {
    axiosApi.post('token', {
      grant_type: 'client_credentials',
      client_id: '82c8da9e-021d-46cd-abf0-d5e943a3ad38',
      client_secret: '9c89cce9-a72d-459a-8e0e-b3b35f90cd31'
    }).then(response => {
      const message = response.data
      if (message && message.access_token) {
        authToken = message.access_token
        console.log('got auth token')
        resolve()
      } else {
        reject('invalid response')
      }
    }).catch(e => {
      reject(e)
    })
  })
}

const startSession = () => {
  axiosApi.post('start-session', {
    callback_uri: `http://${callback.host}:${callback.port}/start-session-callback`
  }, {
    headers: {
      'Authorization': 'Bearer ' + authToken
    }
  }).then(response => {
    console.log('session initiated')
  }).catch(() => {})
}

const server = http.createServer((req, res) => {
  console.log(req.method, req.url)
  let ended = false
  const end = status => {
    if (ended) {
      return
    }
    res.writeHead(status)
    res.end()
    ended = true
  }

  if (req.url === '/start-session-callback' && req.method === 'POST') {
    let body = ''
    req.on('data', data => {
      body += data
    })
    req.on('end', () => {
      try {
        const session = JSON.parse(body)
        console.log(session, 'session started, got keys')
        if (session.keys && session.keys.length) {
          getCustomerHistory(session)
        }
      } catch (e) {
        console.log(e)
        end(400)
      }
    })
  }

  if (req.url === '/customer-history-callback' && req.method === 'POST') {
    let body = ''
    req.on('data', data => {
      body += data
    })
    req.on('end', () => {
      try {
        const history = JSON.parse(body)
        console.log('got customer history')
        console.log(history)
      } catch (e) {
        end(400)
      }
    })
  }

  end(202)
})
server.listen(callback)

const getCustomerHistory = session => {
  const envelopes = []
  const jwePromises = []
  for (const responder of session.keys) {
    jwePromises.push(
      jose.JWE.createEncrypt({ format: 'compact' }, responder.key)
        .update('123456789') // TODO personal id needs to come from somewhere
        .final()
        .then(result => {
          envelopes.push({
            key: responder.uuid,
            envelope: result
          })
        })
    )
  }

  Promise.all(jwePromises).then(() => {
    axiosApi.post(`${session.uuid}/get-customer-history`, {
      callback_uri: `http://${callback.host}:${callback.port}/customer-history-callback`,
      envelopes
    }, {
      headers: {
        'Authorization': 'Bearer ' + authToken
      }
    }).then(response => {
      console.log('request for customer history initiated')
    }).catch(() => {})
  })
}

getAuthToken().then(() => {
  startSession()
}, console.error)
