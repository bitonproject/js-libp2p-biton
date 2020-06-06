'use strict'

const debug = require('debug')('libp2p:biton')
const multiaddr = require('multiaddr')
const Connection = require('interface-connection').Connection
const bitonClient = require('biton')
const toPull = require('stream-to-pull-stream')
const EventEmitter = require('events').EventEmitter

const P2P_MULTIADDR_CODE = 421
const CLOSE_TIMEOUT = 2000

function noop () {}

module.exports = (handler) => {
    const listener = new EventEmitter()

    const server = bitonClient.createServer((socket) => {
        // Avoid uncaught errors caused by unstable connections
        socket.on('error', noop)

        const addr = null // biton does not pack the remoteAddress

        const s = toPull.duplex(socket)

        s.getObservedAddrs = (cb) => cb(null, [addr])

        trackSocket(server, socket)

        const conn = new Connection(s)
        handler(conn)
        listener.emit('connection', conn)
    })

    server.on('listening', () => listener.emit('listening'))
    server.on('error', (err) => listener.emit('error', err))
    server.on('close', () => listener.emit('close'))

    // Keep track of open connections to destroy in case of timeout
    server.__connections = {}

    listener.close = (options, callback) => {
        if (typeof options === 'function') {
            callback = options
            options = {}
        }
        callback = callback || noop
        options = options || {}

        const timeout = setTimeout(() => {
            debug('unable to close graciously, destroying conns')
            Object.keys(server.__connections).forEach((key) => {
                debug('destroying %s', key)
                server.__connections[key].destroy()
            })
        }, options.timeout || CLOSE_TIMEOUT)

        server.close(callback)

        server.once('close', () => {
            clearTimeout(timeout)
        })
    }

    let ipfsId
    let listeningAddr

    listener.listen = (ma, callback) => {
        listeningAddr = ma
        if (ma.protoNames().includes('ipfs')) {
            ipfsId = getIpfsId(ma)
            listeningAddr = ma.decapsulate('ipfs')
        }

        const lOpts = listeningAddr.toOptions()
        debug('Listening on %s %s', lOpts.port, lOpts.host)
        server.listen(Number(lOpts.port), lOpts.host, callback)
    }

    listener.getAddrs = (callback) => {
        const multiaddrs = []
        const addr = server.address()

        if (!addr) {
            return callback(new Error('Listener is not ready yet'))
        }

        let ma
        if (addr.family === 'IPv6') {
            ma = multiaddr(`/ip6/${addr.address}/udp/${addr.port}/utp`)
        } else if (addr.family === 'IPv4') {
            console.log(`/ip4/${addr.address}/udp/${addr.port}/utp`)
            ma = multiaddr(`/ip4/${addr.address}/udp/${addr.port}/utp`)
        }

        if (ipfsId) {
            ma = ma.encapsulate('/ipfs/' + ipfsId)
        }

        multiaddrs.push(ma)

        callback(null, multiaddrs)
    }

    return listener
}

function getIpfsId (ma) {
    return ma.stringTuples().filter((tuple) => {
        return tuple[0] === P2P_MULTIADDR_CODE
    })[0][1]
}

function trackSocket (server, socket) {
    const key = `${socket.remoteAddress}:${socket.remotePort}`
    server.__connections[key] = socket

    socket.on('close', () => {
        delete server.__connections[key]
    })
}
