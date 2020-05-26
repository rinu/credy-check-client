import http from 'http'
import credyCheckClient from './main.js'

const client = credyCheckClient({
  baseURL: 'http://credy-check-api/v1/',
  clientId: '82c8da9e-021d-46cd-abf0-d5e943a3ad38',
  clientSecret: '9c89cce9-a72d-459a-8e0e-b3b35f90cd31'
})
const callback = {
  host: 'your-host-name.tld',
  port: 3001
}
const personalId = '123456789'

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
        console.log('session started, got keys')
        if (session.keys && session.keys.length) {
          client.getCustomerHistory(session, `http://${callback.host}:${callback.port}/customer-history-callback`, personalId)
            .then(() => {
              console.log('sent request for customer history')
            })
            .catch(e => {
              console.error(e)
            })
        }
      } catch (e) {
        console.error(e)
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
        console.log('got customer history', history)
        process.exit()
      } catch (e) {
        console.error(e)
        end(400)
      }
    })
  }

  end(202)
})
server.listen(callback)

client.startSession(`http://${callback.host}:${callback.port}/start-session-callback`)
  .then(() => {
    console.log('session initiated')
  })
  .catch(e => {
    console.error(e)
  })
