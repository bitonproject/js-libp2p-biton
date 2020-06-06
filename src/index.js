'use strict'

const debug = require('debug')('libp2p:biton')
const toPull = require('stream-to-pull-stream')
const mafmt = require('mafmt')
const withIs = require('class-is')
const Connection = require('interface-connection').Connection
const createListener = require('./createListener')


function noop () {}

class biton {

    constructor(opts = null) {
        this.bitonClient = new bitonClient(opts)
    }

    dial (ma, options, callback) {
        if (isFunction(options)) {
            callback = options
            options = {}
        }

        callback = once(callback || noop)

        const cOpts = ma.toOptions()
        debug('Connecting (biton) to %s %s', cOpts.port, cOpts.host)

        const rawSocket = this.bitonClient.socket.connect(cOpts)

        rawSocket.once('timeout', () => {
            debug('timeout')
            rawSocket.emit('error', new Error('Timeout'))
        })

        rawSocket.once('error', callback)

        rawSocket.once('connect', () => {
            rawSocket.removeListener('error', callback)
            callback()
        })

        const socket = toPull.duplex(rawSocket)

        const conn = new Connection(socket)

        conn.getObservedAddrs = (callback) => {
            return callback(null, [ma])
        }

        return conn
    }

    createListener (options, handler) {
        if (isFunction(options)) {
            handler = options
            options = {}
        }

        handler = handler || noop

        return createListener(handler)
    }

    filter (multiaddrs) {
        if (!Array.isArray(multiaddrs)) {
            multiaddrs = [multiaddrs]
        }

        return multiaddrs.filter((ma) => {
            if (includes(ma.protoNames(), 'p2p-circuit')) {
                return false
            }

            if (includes(ma.protoNames(), 'ipfs')) {
                ma = ma.decapsulate('ipfs')
            }

            return mafmt.P2P.matches(ma)
        })
    }
}

module.exports = withIs(biton, { className: 'biton', symbolName: '@bitonproject/js-libp2p-biton/biton' })
