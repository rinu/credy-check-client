import http from 'http'
import credyCheckClient from './main.js'

const client = credyCheckClient({
  baseURL: 'http://credy-check-api/v1/',
  clientId: 'b15fee42-9fa3-4802-b7c3-60f94d6f9189',
  clientSecret: '806f03b5-d01d-430b-90db-6c4f68ca00bd'
})
const callback = {
  host: 'rauno-precision-5530.lan',
  port: 3002
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

  if (req.url === '/v1/key/create' && req.method === 'POST') {
    let body = ''
    req.on('data', data => {
      body += data
    })
    req.on('end', () => {
      try {
        const keyRequest = JSON.parse(body)
        client.sendKey(keyRequest, `http://${callback.host}:${callback.port}/get-customer-data`)
          .then(() => {
            console.log('sent key')
          })
          .catch(e => {
            console.error(e)
          })
      } catch (e) {
        console.error(e)
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
        client.sendCustomerData(historyRequest, personalId => {
          console.log(personalId)

          return new Promise((resolve, reject) => {
            resolve({
              gdpr_consent: true,
              applications_count_30days: 2,
              applications_count_5days: 1,
              last_submitted_application_date: '2020-02-01',
              count_of_active_loans: 1,
              count_of_loans_overdue_5_plus: 0
            })
          })
        }).then(() => {
          console.log('customer data sent')
        }).catch(e => {
          console.error(e)
        })
      } catch (e) {
        console.error(e)
        end(400)
      }
    })
  }

  end(202)
})

server.listen(callback)
