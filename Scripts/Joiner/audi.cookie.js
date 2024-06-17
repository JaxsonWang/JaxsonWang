/*

获取方式：打开  一汽奥迪 app 【官方版】-> 登录成功后访问首页
===================
[MITM]
hostname = audi2c.faw-vw.com

*/

const APIKey = 'idToken'
const $ = new API(APIKey, true)

const token = $.read(APIKey)
!(async () => {
  if (typeof $request != 'undefined') {
    return getToken()
  }
  if (token !== undefined) {
    await signTasker()
  } else {
    $.notify($.name, '', `❌请先获取 Token 🎉`)
  }
})()
  .catch(e => {
    $.log('', `❌失败! 原因: ${e}!`, '')
  })
  .finally(() => {
    $.done()
  })

function getToken() {
  const token = $request.headers['X-ACCESS-TOKEN']
  $.log($request.headers)
  if (token && token.length !== 0) {
    $.write(token, 'cookie')
    $.notify('一汽奥迪', 'Token 写入成功')
  }
  // $.done()
}

const headers = {
  'X-ACCESS-TOKEN': token,
  'X-CHANNEL': 'IOS',
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': `MyAuDi/4.3.2 CFNetwork/1390 Darwin/22.0.0`
}

function task1() {
  const options = {
    baseURL: 'https://audi2c.faw-vw.com/capi/v1/vehicle/browse?task=1',
    method: 'GET',
    headers
  }
  const response = HTTP(options)
  if (response['code'] === 0) {
    if (response['data'] === true) {
      $.notify('浏览车辆签到成功！', '请到一汽奥迪 App 应用确认！')
    } else {
      $.notify('浏览车辆签到失败！', response['message'])
    }
  }
}

function task2() {
  const options = {
    baseURL: 'https://audi2c.faw-vw.com/capi/v1/task/sign_in',
    method: 'GET',
    headers
  }
  const response = HTTP(options)
  if (response['code'] === 0) {
    if (response['data'] === true) {
      $.notify('常规签到成功！', '请到一汽奥迪 App 应用确认！')
    } else {
      $.notify('常规签到成功！', response['message'])
    }
  }
}

function signTasker() {
  task1()
  task2()
}

function ENV() {
  const isJSBox = typeof require == 'function' && typeof $jsbox != 'undefined'
  return {
    isQX: typeof $task !== 'undefined',
    isLoon: typeof $loon !== 'undefined',
    isSurge: typeof $httpClient !== 'undefined' && typeof $utils !== 'undefined',
    isBrowser: typeof document !== 'undefined',
    isNode: typeof require == 'function' && !isJSBox,
    isJSBox,
    isRequest: typeof $request !== 'undefined',
    isScriptable: typeof importModule !== 'undefined',
    isShadowrocket: 'undefined' !== typeof $rocket,
    isStash: 'undefined' !== typeof $environment && $environment['stash-version']
  }
}

function HTTP(defaultOptions = { baseURL: '' }) {
  const { isQX, isLoon, isSurge, isScriptable, isNode, isBrowser, isShadowrocket, isStash } = ENV()
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
  const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/

  function send(method, options) {
    options = typeof options === 'string' ? { url: options } : options
    const baseURL = defaultOptions.baseURL
    if (baseURL && !URL_REGEX.test(options.url || '')) {
      options.url = baseURL ? baseURL + options.url : options.url
    }
    if (options.body && options.headers && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    options = { ...defaultOptions, ...options }
    const timeout = options.timeout
    const events = {
      ...{
        onRequest: () => {},
        onResponse: resp => resp,
        onTimeout: () => {}
      },
      ...options.events
    }
    events.onRequest(method, options)
    let worker
    if (isQX) {
      worker = $task.fetch({ method, ...options })
    } else if (isLoon || isSurge || isNode || isShadowrocket || isStash) {
      worker = new Promise((resolve, reject) => {
        const request = isNode ? require('request') : $httpClient
        request[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err)
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body
            })
        })
      })
    } else if (isScriptable) {
      const request = new Request(options.url)
      request.method = method
      request.headers = options.headers
      request.body = options.body
      worker = new Promise((resolve, reject) => {
        request
          .loadString()
          .then(body => {
            resolve({ statusCode: request.response.statusCode, headers: request.response.headers, body })
          })
          .catch(err => reject(err))
      })
    } else if (isBrowser) {
      worker = new Promise((resolve, reject) => {
        fetch(options.url, {
          method,
          headers: options.headers,
          body: options.body
        })
          .then(response => response.json())
          .then(response =>
            resolve({
              statusCode: response.status,
              headers: response.headers,
              body: response.data
            })
          )
          .catch(reject)
      })
    }
    let timeoutid
    const timer = timeout
      ? new Promise((_, reject) => {
          timeoutid = setTimeout(() => {
            events.onTimeout()
            return reject(`${method}URL:${options.url}exceeds the timeout ${timeout}ms`)
          }, timeout)
        })
      : null
    return (
      timer
        ? Promise.race([timer, worker]).then(res => {
            clearTimeout(timeoutid)
            return res
          })
        : worker
    ).then(resp => events.onResponse(resp))
  }

  const http = {}
  methods.forEach(method => (http[method.toLowerCase()] = options => send(method, options)))
  return http
}

function API(name = 'untitled', debug = false) {
  const { isQX, isLoon, isSurge, isScriptable, isNode, isShadowrocket, isStash } = ENV()
  return new (class {
    constructor(name, debug) {
      this.name = name
      this.debug = debug
      this.http = HTTP()
      this.env = ENV()
      this.node = (() => {
        if (isNode) {
          const fs = require('fs')
          return { fs }
        } else {
          return null
        }
      })()
      this.initCache()
      const delay = (t, v) =>
        new Promise(function (resolve) {
          setTimeout(resolve.bind(null, v), t)
        })
      Promise.prototype.delay = function (t) {
        return this.then(function (v) {
          return delay(t, v)
        })
      }
    }

    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || '{}')
      if (isLoon || isSurge) this.cache = JSON.parse($persistentStore.read(this.name) || '{}')
      if (isNode) {
        let fpath = 'root.json'
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(fpath, JSON.stringify({}), { flag: 'wx' }, err => console.log(err))
        }
        this.root = {}
        fpath = `${this.name}.json`
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(fpath, JSON.stringify({}), { flag: 'wx' }, err => console.log(err))
          this.cache = {}
        } else {
          this.cache = JSON.parse(this.node.fs.readFileSync(`${this.name}.json`))
        }
      }
    }

    persistCache() {
      const data = JSON.stringify(this.cache, null, 2)
      if (isQX) $prefs.setValueForKey(data, this.name)
      if (isLoon || isSurge || isStash || isShadowrocket) $persistentStore.write(data, this.name)
      if (isNode) {
        this.node.fs.writeFileSync(`${this.name}.json`, data, { flag: 'w' }, err => console.log(err))
        this.node.fs.writeFileSync('root.json', JSON.stringify(this.root, null, 2), { flag: 'w' }, err => console.log(err))
      }
    }

    write(data, key) {
      this.log(`SET ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isLoon || isSurge || isStash || isShadowrocket) {
          return $persistentStore.write(data, key)
        }
        if (isQX) {
          return $prefs.setValueForKey(data, key)
        }
        if (isNode) {
          this.root[key] = data
        }
      } else {
        this.cache[key] = data
      }
      this.persistCache()
    }

    read(key) {
      this.log(`READ ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isLoon || isSurge || isStash || isShadowrocket) {
          return $persistentStore.read(key)
        }
        if (isQX) {
          return $prefs.valueForKey(key)
        }
        if (isNode) {
          return this.root[key]
        }
      } else {
        return this.cache[key]
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isLoon || isSurge || isStash || isShadowrocket) {
          return $persistentStore.write(null, key)
        }
        if (isQX) {
          return $prefs.removeValueForKey(key)
        }
        if (isNode) {
          delete this.root[key]
        }
      } else {
        delete this.cache[key]
      }
      this.persistCache()
    }

    notify(title, subtitle = '', content = '', options = {}) {
      const openURL = options['open-url']
      const mediaURL = options['media-url']
      if (isQX) $notify(title, subtitle, content, options)
      if (isSurge) {
        $notification.post(title, subtitle, content + `${mediaURL ? '\n多媒体:' + mediaURL : ''}`, { url: openURL })
      }
      if (isLoon || isStash || isShadowrocket) {
        let opts = {}
        if (openURL) opts['openUrl'] = openURL
        if (mediaURL) opts['mediaUrl'] = mediaURL
        if (JSON.stringify(opts) === '{}') {
          $notification.post(title, subtitle, content)
        } else {
          $notification.post(title, subtitle, content, opts)
        }
      }
      if (isNode || isScriptable) {
        const content_ = content + (openURL ? `\n点击跳转:${openURL}` : '') + (mediaURL ? `\n多媒体:${mediaURL}` : '')
        if (isJSBox) {
          const push = require('push')
          push.schedule({ title: title, body: (subtitle ? subtitle + '\n' : '') + content_ })
        } else {
          console.log(`${title}\n${subtitle}\n${content_}\n\n`)
        }
      }
    }

    log(msg) {
      if (this.debug) console.log(`[${this.name}]LOG:${this.stringify(msg)}`)
    }

    info(msg) {
      console.log(`[${this.name}]INFO:${this.stringify(msg)}`)
    }

    error(msg) {
      console.log(`[${this.name}]ERROR:${this.stringify(msg)}`)
    }

    wait(millisec) {
      return new Promise(resolve => setTimeout(resolve, millisec))
    }

    done(value = {}) {
      if (isQX || isLoon || isSurge || isStash || isShadowrocket) {
        $done(value)
      } else if (isNode && !isJSBox) {
        if (typeof $context !== 'undefined') {
          $context.headers = value.headers
          $context.statusCode = value.statusCode
          $context.body = value.body
        }
      }
    }

    stringify(obj_or_str) {
      if (typeof obj_or_str === 'string' || obj_or_str instanceof String) return obj_or_str
      else
        try {
          return JSON.stringify(obj_or_str, null, 2)
          // eslint-disable-next-line no-unused-vars
        } catch (err) {
          return '[object Object]'
        }
    }
  })(name, debug)
}
