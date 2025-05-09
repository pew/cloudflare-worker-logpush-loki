import { inflate } from 'pako'

async function transformLogs(obj) {
  const encoding = obj.contentEncoding || undefined
  let payload = obj.payload
  const jobname = obj.job || 'cloudflare_logpush'

  const lokiFormat = {
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

    const data = inflate(payload)
    const logdata = new Uint16Array(data).reduce((data, byte) => data + String.fromCharCode(byte), '')
    log = logdata.split('\n')
  } else {
    const date = new Date().getTime() * 1000000
    if (obj.contentType.includes('application/json')) {
      log = await payload.json()
    }
    if (obj.contentType.includes('application/text')) {
      log = await payload.text()
    }
    lokiFormat.streams[0].values.push([date.toString(), JSON.stringify(log)])
    return lokiFormat
  }

  log.forEach((element) => {
    const date = element.EdgeStartTimestamp || new Date().getTime() * 1000000
    lokiFormat.streams[0].values.push([date.toString(), element])
  })

  return lokiFormat
}

async function pushLogs(payload, credentials, env) {
  const lokiServer = env.lokiHost
  const req = await fetch(lokiServer, {
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
    const job = searchParams.get('job')

    const authHeader = request.headers.get('authorization')
    const contentEncoding = request.headers.get('content-encoding')
    const contentType = request.headers.get('content-type')

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
    const output = await transformLogs({ payload: await request, contentEncoding, job, contentType })

    await pushLogs(output, authHeader, env)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'content-type': 'application/json' },
    })
  },
}
