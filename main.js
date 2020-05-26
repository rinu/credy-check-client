import axios from 'axios'
import jose from 'node-jose'

const client = settings => {
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('clientId and/or clientSecret not provided')
  }

  const self = client

  self.clientId = settings.clientId
  self.clientSecret = settings.clientSecret
  self.baseURL = settings.baseURL || (process.env.NODE_ENV === 'production' ? 'https://api.credycheck.com/v1/' : 'http://api.credycheck.staging.apps.cluster.credytest.tk/v1/')

  const keys = {}

  const axiosApi = axios.create({
    baseURL: self.baseURL
  })

  const getAuthToken = () => {
    if (self.authToken && self.authToken.expires > (new Date()).getTime()) {
      return new Promise((resolve, reject) => {
        resolve(self.authToken.accessToken)
      })
    }

    return axiosApi.post('token', {
      grant_type: 'client_credentials',
      client_id: self.clientId,
      client_secret: self.clientSecret
    }).then(response => {
      const message = response.data
      if (message && message.access_token) {
        self.authToken = {
          accessToken: message.access_token,
          expires: (new Date()).getTime() + (message.expires_in - 10) * 1000
        }
        return message.access_token
      }

      throw new Error('failed to get access token')
    })
  }

  self.startSession = callbackUri => {
    return getAuthToken().then(authToken => {
      return axiosApi.post('start-session', {
        callback_uri: callbackUri
      }, {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      })
    })
  }

  self.getCustomerHistory = (session, callbackUri, personalId) => {
    let authToken
    const authPromise = getAuthToken().then(token => {
      authToken = token
    })

    const envelopes = []
    const jwePromises = []
    for (const responder of session.keys) {
      jwePromises.push(
        jose.JWE.createEncrypt({ format: 'compact' }, responder.key)
          .update(personalId)
          .final()
          .then(result => {
            envelopes.push({
              key: responder.uuid,
              envelope: result
            })
          })
      )
    }

    return Promise.all([authPromise].concat(jwePromises)).then(() => {
      return axiosApi.post(`${session.uuid}/get-customer-history`, {
        callback_uri: callbackUri,
        envelopes
      }, {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      })
    })
  }

  self.sendKey = (keyRequest, callbackUri) => {
    const sessionUuid = keyRequest.session_uuid
    const promises = []
    promises.push(getAuthToken())
    promises.push(jose.JWK.createKey('RSA', 4096, { alg: 'RSA-OAEP-256', use: 'enc' }))
    return Promise.all(promises).then(values => {
      const authToken = values[0]
      const key = values[1]
      keys[sessionUuid] = key
      const publicKeyJwk = key.toJSON()
      return axios.post(keyRequest.callback_uri, {
        customer_data_callback_uri: callbackUri,
        key: publicKeyJwk
      }, {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      }).finally(() => {
        setTimeout(() => {
          delete keys[sessionUuid]
        }, 30000)
      })
    })
  }

  self.sendCustomerData = (historyRequest, callback) => {
    const key = keys[historyRequest.session_uuid]
    return jose.JWE.createDecrypt(key)
      .decrypt(historyRequest.envelope)
      .then(result => {
        return callback(result.payload.toString()).then(customerData => {
          return getAuthToken().then(authToken => {
            return axios.post(historyRequest.callback_uri, customerData, {
              headers: {
                'Authorization': 'Bearer ' + authToken
              }
            })
          })
        })
      })
  }

  return self
}

export default client
