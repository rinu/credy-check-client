import http from 'http'
import axios from 'axios'
import jose from 'node-jose'

const axiosApi = axios.create({
  baseURL: 'http://credy-check-api/v1/'
})
const callback = {
  host: 'rauno-precision-5530.lan',
  port: 3002
}

const getAuthToken = () => {
  return new Promise((resolve, reject) => {
    axiosApi.post('token', {
      grant_type: 'client_credentials',
      client_id: 'b15fee42-9fa3-4802-b7c3-60f94d6f9189',
      client_secret: '806f03b5-d01d-430b-90db-6c4f68ca00bd'
    }).then(response => {
      const message = response.data
      if (message && message.access_token) {
        console.log('got auth token')
        resolve(message.access_token)
      } else {
        reject('invalid response')
      }
    }).catch(e => {
      reject(e)
    })
  })
}

const keys = {}

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

  if (req.url === '/v1/key/create' && req.method === 'POST') {
    let body = ''
    req.on('data', data => {
      body += data
    })
    req.on('end', () => {
      try {
        const keyRequest = JSON.parse(body)
        const promises = []
        promises.push(jose.JWK.createKey('RSA', 4096, { alg: 'RSA-OAEP-256', use: 'enc' }))
        promises.push(getAuthToken())
        Promise.all(promises).then(values => {
          const key = values[0]
          const authToken = values[1]
          keys[keyRequest.session_uuid] = key
          const publicKeyJwk = key.toJSON()
          axios.post(keyRequest.callback_uri, {
            customer_data_callback_uri: `http://${callback.host}:${callback.port}/get-customer-data`,
            key: publicKeyJwk
          }, {
            headers: {
              'Authorization': 'Bearer ' + authToken
            }
          })
          console.log('sent key')
        })
      } catch (e) {
        console.log(e)
        end(400)
      }
    })
  }

  if (req.url.endsWith('customer/get') && req.method === 'POST') {
    let body = ''
    req.on('data', data => {
      body += data
    })
    req.on('end', () => {
      try {
        const historyRequest = JSON.parse(body)

        const key = keys[historyRequest.session_uuid]
        const promises = []
        promises.push(jose.JWE.createDecrypt(key).decrypt(historyRequest.envelope))
        promises.push(getAuthToken())
        Promise.all(promises).then(values => {
          const result = values[0]
          const authToken = values[1]

          console.log(result.payload.toString())

          delete keys[historyRequest.session_uuid]

          axios.post(historyRequest.callback_uri, {
            gdpr_consent: true,
            applications_count_30days: 2,
            applications_count_5days: 1,
            last_submitted_application_date: '2020-02-01',
            count_of_active_loans: 1,
            count_of_loans_overdue_5_plus: 0
          }, {
            headers: {
              'Authorization': 'Bearer ' + authToken
            }
          })
        })
      } catch (e) {
        console.log(e)
        end(400)
      }
    })
  }

  end(202)
})

server.listen({
  port: callback.port,
  host: '0.0.0.0'
})
