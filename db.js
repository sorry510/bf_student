const { log } = require('./utils')
const { database } = require('./config')
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    database: database.name,
  },
})

async function createTableIF() {
  await db.schema
    .createTable('users', table => {
      table.increments('id')
      table.string('username')
      table.string('password')
    })
    .createTable('symbols', table => {
      table.increments('id')
      table.string('symbol')
      table.string('quantity')
      table.string('percentChange')
      table.string('close')
      table.string('open')
      table.string('low')
      table.integer('enable')
      table.integer('updateTime')
    })
  log('create table success', true)
}

module.exports = {
  knex,
}
