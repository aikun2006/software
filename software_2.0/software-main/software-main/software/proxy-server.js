/**
 * TTS代理服务器
 * 运行: node proxy-server.js
 */

const http = require('http')
const https = require('https')

const PORT = 3000
const APP_ID = '5897452773'
const ACCESS_TOKEN = 'JYyWQCrTx9vbrH6aLxklZFNUKCq8IMWD'
const VOICE_TYPE = 'BV700_streaming'

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } 
      catch(e) { reject(e) }
    })
  })
}

function tts(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app: { appid: APP_ID, token: ACCESS_TOKEN, cluster: 'volcano_tts' },
      user: { uid: 'user_' + Date.now() },
      audio: { voice_type: VOICE_TYPE, encoding: 'mp3', speed_ratio: 1.0, volume_ratio: 1.0, pitch_ratio: 1.0 },
      request: { reqid: 'req_' + Date.now(), text: text, text_type: 'plain', operation: 'query' }
    })

    const options = {
      hostname: 'openspeech.bytedance.com',
      port: 443,
      path: '/api/v1/tts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer;' + ACCESS_TOKEN,
        'Content-Length': Buffer.byteLength(data)
      }
    }

    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ': ' + buf.toString().substring(0, 100)))
          return
        }
        try {
          const json = JSON.parse(buf.toString())
          if (json.data) {
            resolve(Buffer.from(json.data, 'base64'))
          } else {
            reject(new Error('No audio data'))
          }
        } catch(e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.url === '/api/tts' && req.method === 'POST') {
    try {
      const body = await getBody(req)
      console.log('[TTS] ' + body.text.substring(0, 30) + '...')
      const audio = await tts(body.text)
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length })
      res.end(audio)
      console.log('[TTS] OK ' + audio.length + ' bytes')
    } catch(e) {
      console.error('[TTS] Error:', e.message)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({error: e.message}))
    }
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log('TTS Proxy running: http://localhost:' + PORT + '/api/tts')
})
