const dotenv = require('dotenv')

dotenv.config('./env')
const env = process.env

const database = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  name: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
}

const web = {
  port: env.WEB_PORT || 80,
}

const log = env.LOG.toLowerCase() === 'true'

module.exports = {
  database,
  web,
  log,
}
