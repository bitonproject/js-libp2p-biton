/* eslint-env mocha */
'use strict'

const tests = require('libp2p-interfaces/src/transport/tests')
const multiaddr = require('multiaddr')
const biton = require('../src')

describe('compliance', () => {
  tests({
    setup (options) {
      let transport = new biton(options)

      const addrs = [
        multiaddr('/p2p/5F8sJA8KuQ5ZEeSGHWVGTpbfu6axtMp3QF1gBRJTKszN'),
        multiaddr('/p2p/CKqdMUMWKvAnWFJ96D7FppsEdtvsMxS7AQo2du2FbPYb')
      ]

      const network = require('../src/biton-socket')
      const connect = network.connect
      const connector = {
        delay (delayMs) {
          // Add a delay in the connection mechanism for the transport
          // (this is used by the dial tests)
          network.connect = (...args) => setTimeout(() => connect(...args), delayMs)
        },
        restore () {
          // Restore the connection mechanism to normal
          network.connect = connect
        }
      }

      return { transport, addrs, connector }
    },
    teardown () {
      // Clean up any resources created by setup()
    }
  })
})
