import { inflate } from 'pako'

async function transformLogs(obj) {
  let encoding = obj.contentEncoding || undefined
  let payload = obj.payload
  let jobname = obj.job || 'cloudflare_logpush'

  let lokiFormat = {
    streams: [
      {
        stream: {
          job: jobname,
        },
        values: [],
      },
    ],
  }

  let log

  if (encoding === 'gzip') {
    payload = await payload.arrayBuffer()

    let data = inflate(payload)
    let logdata = new Uint16Array(data).reduce(function (data, byte) {
      return data + String.fromCharCode(byte)
    }, '')
    log = logdata.split('\n')
  } else {
    let date = new Date().getTime() * 1000000
    log = await payload.json()
    lokiFormat.streams[0].values.push([date.toString(), JSON.stringify(log)])
    return lokiFormat
  }

  log.forEach((element) => {
    let date = element.EdgeStartTimestamp || new Date().getTime() * 1000000
    lokiFormat.streams[0].values.push([date.toString(), element])
  })

  return lokiFormat
}

async function pushLogs(payload, credentials, env) {
  let lokiServer = env.lokiHost
  let req = await fetch(lokiServer, {
    body: JSON.stringify(payload),
    method: 'POST',
    headers: {
      Authorization: credentials,
      'Content-Type': 'application/json',
    },
  })
  return req
}

export default {
  async fetch(request, env) {
    const { searchParams } = new URL(request.url)
    let job = searchParams.get('job')

    const authHeader = request.headers.get('authorization')
    const contentEncoding = request.headers.get('content-encoding')

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify(
          { success: false, message: 'please authenticate and use POST requests' },
          { headers: { 'content-type': 'application/json' } },
        ),
      )
    }

    if (!authHeader) {
      return new Response(
        JSON.stringify(
          { success: false, message: 'please authenticate' },
          { headers: { 'content-type': 'application/json' } },
        ),
      )
    }
    const output = await transformLogs({ payload: await request, contentEncoding, job })

    await pushLogs(output, authHeader, env)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'content-type': 'application/json' },
    })
  },
}
