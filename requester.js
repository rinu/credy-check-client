import http from 'http'
import jose from 'node-jose'

const hostname = 'api.credycheck.staging.apps.cluster.credytest.tk'
const callback = {
  host: 'enternum.net',
  port: 3001
}

let authToken

const getAuthToken = () => {
  return new Promise((resolve, reject) => {
    const authPostData = JSON.stringify({
      grant_type: 'client_credentials',
      client_id: 'b9050b8d-d46c-4d72-a29e-3e29096d65fc',
      client_secret: 'ecc55813-8d6c-4d80-a413-2f7011e62d14'
    })

    const authReq = http.request({
      hostname,
      path: '/v1/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(authPostData)
      }
    }, response => {
      let fullResponse = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        fullResponse += chunk
      })
      response.on('end', () => {
        try {
          const message = JSON.parse(fullResponse)

          if (message && message.access_token) {
            authToken = message.access_token
            console.log('got auth token')
            resolve()
          } else {
            reject('invalid response')
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    authReq.on('error', e => {
      reject(e)
    })

    authReq.write(authPostData)
    authReq.end()
  })
}

const startSession = () => {
  const postData = JSON.stringify({
    callback_uri: `http://${callback.host}:${callback.port}/start-session-callback`
  })

  const req = http.request({
    hostname,
    path: '/v1/start-session',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': 'Bearer ' + authToken
    }
  }, response => {
    console.log('session initiated')
  })

  req.write(postData);
  req.end();
}

const server = http.createServer((req, res) => {
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
        console.log('session started, got keys')
        getCustomerHistory(session)
      } catch (e) {
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

  end(200)
})
server.listen(callback.port)

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
    const postData = JSON.stringify({
      callback_uri: `http://${callback.host}:${callback.port}/customer-history-callback`,
      envelopes
    })

    const req = http.request({
      hostname,
      path: `/v1/${session.uuid}/get-customer-history`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer ' + authToken
      }
    }, response => {
      console.log('request for customer history initiated')
    })

    req.write(postData);
    req.end();
  })
}

getAuthToken().then(() => {
  startSession()
}, console.error)
