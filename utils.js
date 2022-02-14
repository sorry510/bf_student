const config = require('./config')

async function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function transformTime(tzTime, format = 'Y-m-d H:i:s') {
  return dateFormat(new Date(tzTime), format)
}

/**
 *
 * @param string format
 * @returns string
 */
function dateFormat(date, format = 'Y-m-d H:i:s') {
  date = date || new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return format
    .replace('Y', year)
    .replace('m', month.toString().padStart(2, 0))
    .replace('d', day.toString().padStart(2, 0))
    .replace('H', hour.toString().padStart(2, 0))
    .replace('i', minute.toString().padStart(2, 0))
    .replace('s', second.toString().padStart(2, 0))
}

function log(text, flag = null) {
  const isLog = flag !== null ? flag : config.log
  if (isLog) {
    if (typeof text === 'object') {
      console.log(`${dateFormat()}: ${JSON.stringify(text)}`)
    } else {
      console.log(`${dateFormat()}: ${text}`)
    }
  }
}

/**
 * 尝试执行函数
 * @param () =>{} fn
 * @param number max 最大次数
 * @param number sleepTime 失败时的休眠时间
 * @param bool isThrow 超过最大次数时，是否抛出异常
 * @returns
 */
async function tries(fn, max = 5, sleepTime = 1000, isThrow = false) {
  let num = 0
  let error
  while (num++ < max) {
    try {
      const result = await fn()
      return result
    } catch (e) {
      e = error
      console.log(`exec failed, num is ${num}`)
      await sleep(sleepTime)
    }
  }
  if (isThrow) {
    throw new Error(error)
  }
}

module.exports = {
  sleep,
  transformTime,
  dateFormat,
  log,
  tries,
}
