const express = require('express')
const cors = require('cors-express')
const jwt = require('express-jwt')
const jwtToken = require('jsonwebtoken')
const fs = require('fs')
const xlsx = require('node-xlsx')
const path = require('path')
const { exit } = require('process')

const { knex } = require('../db')
const { web } = require('../config.js')
const { resJson, isSuperAdmin, isManager } = require('./utils')
const { dateFormat, transformTime } = require('../utils')
const currentDir = path.dirname(__filename)
const webIndex = '/'
const secret = 'xyz666my'

const app = express()
const port = web.port || 2222
const user = {
  name: web.username || 'admin',
  password: web.password || 'admin',
}

const options = {
  allow: {
    origin: '*',
    methods: 'GET,PATCH,PUT,POST,DELETE,HEAD,OPTIONS',
    headers: 'Content-Type, Authorization, Content-Length, X-Requested-With, X-HTTP-Method-Override',
  },
  options: function (req, res, next) {
    if (req.method == 'OPTIONS') {
      res.status(204).end()
    } else {
      next()
    }
  },
}

// 静态资源
app.use(express.static(path.join(currentDir, 'dist'), { index: false }))

// 跨域配置
app.use(cors(options))

// jwt token 设置
app.use(
  jwt({
    secret, // 签名的密钥 或 PublicKey
    algorithms: ['HS256'],
  }).unless({
    path: ['/login', '/students/excel', webIndex], // 指定路径不经过 Token 解析
  })
)

// token 校验
app.use(function (err, req, res, next) {
  if (req.path.includes('static') && !req.path.includes('index.html')) {
    // 避免静态资源被jwt校验
    next()
  } else if (err.name === 'UnauthorizedError') {
    res.status(401).send('invalid token...')
    // res.status(404).end()
  }
})
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// 登录
app.post('/login', async (req, res) => {
  const { body } = req
  const { username, password } = body
  const user = await knex.table('admin').where('name', username).where('status', 1).first()
  if (user && user.password === password) {
    const token =
      'Bearer ' +
      jwtToken.sign(
        {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          role_id: user.role_id,
        },
        secret,
        {
          expiresIn: 3600 * 24 * 30, // 过期时间 30 天
        }
      )
    res.json(
      resJson(200, {
        token,
        name: user.name,
        nickname: user.nickname,
        role_id: user.role_id,
      })
    )
  } else {
    res.json(resJson(101, '账号或密码错误'))
  }
})

// 获取当前用户信息
app.get('/user/info', async (req, res) => {
  const { user } = req
  const userInfo = await knex.table('admin').where('id', user.id).first('id', 'name', 'role_id')
  res.json(resJson(200, userInfo))
})

// 修改密码
app.put('/repassword', async (req, res) => {
  const { body, user } = req

  const userInfo = await knex.table('admin').where('id', user.id).first()
  if (userInfo) {
    if (userInfo.password === body.old_password) {
      await knex.table('admin').where('id', user.id).update({ password: body.new_password })
      res.json(resJson(200))
    } else {
      res.json(resJson(101, '旧密码错误'))
    }
  }
  res.json(resJson(401, '没有用户信息'))
})

// 获取所有用户
app.get('/users', async (req, res) => {
  const {
    query: { sort = '+' },
  } = req
  const users = await knex
    .table('admin')
    .where('status', 1)
    .where('role_id', '>', 1)
    .orderBy('id', 'asc')
    .select('id', 'name', 'nickname')
  res.json(resJson(200, users))
})

// // 新增用户
// app.post('/users', async (req, res) => {
//   const { body, user } = req
//   const data = {
//     ...body,
//     create_time: dateFormat(),
//     update_time: dateFormat(),
//   }
//   if (isSuperAdmin(user)) {
//     const result = await knex('admin').insert(data)
//     res.json(resJson(200))
//   }
//   res.json(resJson(401, '没有权限'))
// })

// // 修改用户
// app.put('/users/:id', async (req, res) => {
//   const {
//     body,
//     params: { id },
//     user,
//   } = req
//   const data = {
//     ...body,
//     create_time: dateFormat(),
//     update_time: dateFormat(),
//   }
//   if (isSuperAdmin(user)) {
//     const result = await knex('admin').where('id', id).update(data)
//     res.json(resJson(200))
//   }
//   res.json(resJson(401, '没有权限'))
// })

// // 删除用户
// app.delete('/users/:id', async (req, res) => {
//   const {
//     params: { id },
//     user,
//   } = req
//   if (isSuperAdmin(user)) {
//     const result = await knex('admin').where('id', id).delete()
//     res.json(resJson(200))
//   }
//   res.json(resJson(401, '没有权限'))
// })

// 获取所有学生
app.get('/students', async (req, res) => {
  const {
    query: {
      sort = 'id-',
      page = 1,
      page_size = 10,
      search,
      startTime,
      endTime,
      classType,
      source,
      isEffective,
      userId,
    },
  } = req
  const orderField = sort.slice(0, -1)
  const direction = sort.slice(-1) === '+' ? 'asc' : 'desc'

  const builderWhere = query => {
    if (search) {
      query.where(builder => {
        const field = search.trim()
        builder
          .orWhere('name', 'like', `%${field}%`)
          .orWhere('wx', 'like', `%${field}%`)
          .orWhere('phone', 'like', `%${field}%`)
      })
    }
    if (startTime) {
      query.where('create_time', '>=', `${startTime} 00:00:00`)
    }
    if (endTime) {
      query.where('create_time', '<=', `${endTime} 23:59:59`)
    }
    if (classType) {
      query.where('class_type', classType)
    }
    if (source) {
      query.where('source', source)
    }
    if (isEffective) {
      query.where('effective', isEffective)
    }
    if (userId) {
      query.where('user_id', userId)
    }
    query.whereNull('delete_time') // 没有删除的
  }
  const students = await knex
    .table('student')
    .limit(page_size)
    .offset(page_size * (page - 1))
    .where(builderWhere)
    .orderBy(orderField, direction)
    .select()
  // .toSQL()
  // .toNative()

  const total = await knex.table('student').where(builderWhere).count('id')

  res.json(
    resJson(200, {
      page,
      page_size,
      total: total[0]['count(`id`)'],
      list: students.map(item => ({ ...item, create_time: transformTime(item.create_time) })),
    })
  )
})

// excel导出
app.get('/students/excel', async (req, res) => {
  const {
    query: { sort = 'id-', search, startTime, endTime, classType, source, isEffective, userId },
  } = req
  const orderField = sort.slice(0, -1)
  const direction = sort.slice(-1) === '+' ? 'asc' : 'desc'

  const builderWhere = query => {
    if (search) {
      query.where(builder => {
        const field = search.trim()
        builder
          .orWhere('name', 'like', `%${field}%`)
          .orWhere('wx', 'like', `%${field}%`)
          .orWhere('phone', 'like', `%${field}%`)
      })
    }
    if (startTime) {
      query.where('create_time', '>=', `${startTime} 00:00:00`)
    }
    if (endTime) {
      query.where('create_time', '<=', `${endTime} 23:59:59`)
    }
    if (classType) {
      query.where('class_type', classType)
    }
    if (source) {
      query.where('source', source)
    }
    if (isEffective) {
      query.where('effective', isEffective)
    }
    if (userId) {
      query.where('user_id', userId)
    }
    query.whereNull('delete_time')
  }
  const students = await knex
    .table('student')
    .where(builderWhere)
    .orderBy(orderField, direction)
    .select('name', 'sex', 'wx', 'phone', 'class_type', 'source', 'remarks', 'effective', 'user_name', 'create_time')
  const sourceTexts = ['未知', '小红书', 'b站', '抖音', '知乎', '百度贴吧', '百度', '转介绍', '其它']
  const excelData = []
  const title = ['姓名', '性别', '微信号', '电话', '课程', '来源', '备注', '是否成交', '业务老师', '录入时间'] //这是第一行
  excelData.push(title)
  students.forEach(student => {
    const line = []
    line.push(student.name)
    line.push(student.sex === 1 ? '男' : '女')
    line.push(student.wx)
    line.push(student.phone)
    line.push(student.class_type === 1 ? '前端' : 'UI')
    line.push(sourceTexts[student.source])
    line.push(student.remarks)
    line.push(student.effective === 1 ? '是' : '否')
    line.push(student.user_name)
    line.push(transformTime(student.create_time))
    excelData.push(line) // data中添加的要是数组，可以将对象的值分解添加进数组，例如：['1','name','上海']
  })
  const buffer = xlsx.build([{ name: 'sheet1', data: excelData }])
  const filePath = path.join(currentDir, 'excel', `学生信息-${dateFormat(null, 'Y_m_d_H_i_s')}.xlsx`)
  fs.writeFileSync(filePath, buffer)
  res.download(filePath)
})

// 新增学生
app.post('/students', async (req, res) => {
  const { body, user } = req

  if (body.wx) {
    const student = await knex('student').where('wx', body.wx).whereNull('delete_time').first()
    if (student) {
      res.json(resJson(101, '微信号重复，不能录入'))
    }
  }
  if (body.phone) {
    const student = await knex('student').where('phone', body.phone).whereNull('delete_time').first()
    if (student) {
      res.json(resJson(101, '手机号重复，不能录入'))
    }
  }

  const data = {
    ...body,
    effective: 2,
    user_id: body.user_id ? body.user_id : user.id,
    user_name: body.user_name ? body.user_name : user.nickname,
    create_time: dateFormat(),
    update_time: dateFormat(),
  }

  const result = await knex('student').insert(data)
  res.json(resJson(200, '新增成功'))
})

// 修改学生
app.put('/students/:id', async (req, res) => {
  const {
    body,
    user,
    params: { id },
  } = req

  const student = await knex('student').where('id', id).whereNull('delete_time').first()
  if (student) {
    if (isManager(user)) {
      const data = {
        ...body,
        update_time: dateFormat(),
      }
      const result = await knex('student').where('id', id).update(data)
      res.json(resJson(200, '修改成功'))
      return
    }
  }
  res.json(resJson(401, '没有权限'))
})

// 修改学生是否有效
app.put('/students/:id/effective', async (req, res) => {
  const {
    body,
    user,
    params: { id },
  } = req

  const student = await knex('student').where('id', id).whereNull('delete_time').first()
  if (student) {
    if (isManager(user)) {
      const data = {
        effective: body.effective,
        remarks: body.remarks,
        update_time: dateFormat(),
      }
      const result = await knex('student').where('id', id).update(data)
      res.json(resJson(200))
      return
    }
  }
  res.json(resJson(401, '没有权限'))
})

// 删除学生
app.delete('/students/:id', async (req, res) => {
  const {
    user,
    params: { id },
  } = req
  const student = await knex('student').where('id', id).whereNull('delete_time').first()
  if (student) {
    // if (isSuperAdmin(user) || student.user_id === user.id) {
    if (isSuperAdmin(user)) {
      const result = await knex('student').where('id', id).update({ delete_time: dateFormat() })
      res.json(resJson(200))
      return
    }
  }
  res.json(resJson(401, '没有权限'))
})

// 查看前台页面
app.get(webIndex, (req, res) => {
  res.sendFile(path.resolve(currentDir, './dist/index.html'), { maxAge: 0 })
})

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})
