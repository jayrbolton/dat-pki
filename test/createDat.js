const fork = require('child_process').fork
const json = require('../lib/utils/json')
const test = require('tape')
const fs = require('fs-extra')
const assert = require('assert')

const {setup, createDat, handshake, checkHandshake} = require('../')
const prefix = 'test/tmp'
fs.ensureDir(prefix)

// Integration tests for creating a new dat for a certain contacts/groups 

// sequence of events for this test
// - parent sets up user
// - child sets up user
// - parent handshakes child
// - child handshakes parent
// - parent checks handshake for child
// - child checks handshake for parent
// - parent shares dat with child
// - child finds and downloads dat
test('createDat for contact', (t) => {
  // Parent directory of test folders, files, and dats for this test
  const path = prefix + '/createDat-test'
  fs.ensureDir(path)
  var userA, relDat, relDatFrom
  const child = fork('./test/createDat-childProcess.js')
  // Handle messages from the child process to this parent process
  child.on("message", (msg) => {
    const {name, data} = msg
    console.log('parent got', name)
    handlers[name](data)
  })
  child.on('close', (code) => console.log(`child process exited with code ${code}`))
  // Set up userA
  setup({path: path + '/userA-base', name: 'userA', pass: 'arstarst'}, (u) => {
    userA = u
    child.send({name: 'setup'})
  })
  const handlers = {
    handshake: (userBKey) => {
      handshake(userA, userBKey, (userA, userB, dat) => {
        child.send({name: 'handshake', data: userA.publicDat.key.toString('hex')})
        relDat = dat
      })
    }
  , checkHandshake: (userBKey) => {
      checkHandshake(userA, userBKey, (userA, userB, dat) => {
        relDatFrom = dat
        createDat(userA, 'userAShare', [userB.id], (dat) => {
          relDat.close()
          relDatFrom.close()
          userA.publicDat.close()
          const dats = json.read(path + '/userA-base/relationships/' + userB.id + '/dats.json')
          console.log("DATS", dats)
          t.deepEqual(dats.userAShare, dat.key.toString('hex'))
          t.assert(fs.existsSync(path + '/userA-base/dats/' + dat.key.toString('hex') + '/.dat'))
          child.send({name: 'done', data: null})
          t.end()
        })
      })
    }
  }
})
