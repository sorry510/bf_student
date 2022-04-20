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
  return user.role_id === 1 // 超级管理员
}


function isManager(user) {
  return user.role_id === 1 || user.role_id === 2 // 管理员
}

module.exports = {
  resJson,
  isSuperAdmin,
  isManager
}
