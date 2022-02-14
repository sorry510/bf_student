function resJson(code = 200, msg, data) {
  if (typeof msg === 'object') {
    data = msg
    msg = 'success'
  }
  return {
    code,
    msg,
    data,
  }
}

function isSuperAdmin(user) {
  return user.role_id === 1
}

module.exports = {
  resJson,
  isSuperAdmin,
}
