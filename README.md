# Logpush to Grafana Loki Endpoint

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/pew/cloudflare-worker-logpush-loki)

- [Logpush to Grafana Loki Endpoint](#logpush-to-grafana-loki-endpoint)
  - [Create the Worker](#create-the-worker)
  - [Logpush](#logpush)
    - [Get Log Fields](#get-log-fields)
    - [Create Logpush Job](#create-logpush-job)
  - [Debugging](#debugging)
  - [Todo / Improvements](#todo--improvements)

You can configure Cloudflare Logpush to send Logs to any [HTTP destination](https://developers.cloudflare.com/logs/get-started/enable-destinations/http/), so let's send some logs to [Grafana Loki](https://grafana.com/oss/loki/).

This Worker takes the incoming Logpush JSON Format and transforms it into something Loki understands:

- take incoming gzipped Logpush data, unpack it
- merge all fields into the Loki API format and send it off to the destination
- profit

## Create the Worker

- clone this repo
- update `wrangler.jsonc` to point to your Grafana Loki HTTP Endpoint
- feel free to make other adjustments in `wrangler.jsonc` to your liking
- deploy the worker:

```shell
npm run deploy
```

Note down the returned URL to create the actual logpush job.

## Logpush

- You can configure Cloudflare Logpush through the Dashboard or API.

### Get Log Fields

First, get all the available log fields for your zone. To do this, get your Zone ID from the Cloudflare Dashboard and generate an API Key. Replace `<ZONE_ID>` and `your-token-here` in the following command:

```shell
curl -s "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/logpush/datasets/http_requests/fields" -H "Authorization: Bearer your-token-here" -H 'Content-Type: application/json' | jq -r '.result|keys[]'|tr '\n' ',' | sed 's/,$/\n/'
```

You should see a comma separated list of available fields you can send to your destination

```
BotScore,BotScoreSrc,BotTags,CacheCacheStatus,CacheReserveUsed,CacheResponseBytes,CacheResponseStatus,CacheTieredFill,ClientASN,ClientCountry,ClientDeviceType,ClientIP,ClientIPClass,ClientMTLSAuthCertFingerprint,ClientMTLSAuthStatus,ClientRequestBytes,ClientRequestHost,ClientRequestMethod,ClientRequestPath,ClientRequestProtocol,ClientRequestReferer,ClientRequestScheme,ClientRequestSource,ClientRequestURI,ClientRequestUserAgent,ClientSSLCipher,ClientSSLProtocol,ClientSrcPort,ClientTCPRTTMs,ClientXRequestedWith,Cookies,EdgeCFConnectingO2O,EdgeColoCode,EdgeColoID,EdgeEndTimestamp,EdgePathingOp,EdgePathingSrc,EdgePathingStatus,EdgeRateLimitAction,EdgeRateLimitID,EdgeRequestHost,EdgeResponseBodyBytes,EdgeResponseBytes,EdgeResponseCompressionRatio,EdgeResponseContentType,EdgeResponseStatus,EdgeServerIP,EdgeStartTimestamp,EdgeTimeToFirstByteMs,FirewallMatchesActions,FirewallMatchesRuleIDs,FirewallMatchesSources,JA3Hash,OriginDNSResponseTimeMs,OriginIP,OriginRequestHeaderSendDurationMs,OriginResponseBytes,OriginResponseDurationMs,OriginResponseHTTPExpires,OriginResponseHTTPLastModified,OriginResponseHeaderReceiveDurationMs,OriginResponseStatus,OriginResponseTime,OriginSSLProtocol,OriginTCPHandshakeDurationMs,OriginTLSHandshakeDurationMs,ParentRayID,RayID,RequestHeaders,ResponseHeaders,SecurityLevel,SmartRouteColoID,UpperTierColoID,WAFAction,WAFFlags,WAFMatchedVar,WAFProfile,WAFRuleID,WAFRuleMessage,WorkerCPUTime,WorkerStatus,WorkerSubrequest,WorkerSubrequestCount,WorkerWallTimeUs,ZoneID,ZoneName
```

### Create Logpush Job

Here's a curl request to create a Logpush Job with a lot of included fields already. You might want to update the `fields=` field below with the output from above. Please keep the `&timestamps=unixnano`:

```
curl --location --request POST 'https://api.cloudflare.com/client/v4/zones/<zone id>/logpush/jobs' \
--header 'X-Auth-Email: you@example.com' \
--header 'X-Auth-Key: abcSecretAPIKey' \
--header 'Content-Type: application/json' \
--data-raw '{
    "name": "http",
    "logpull_options": "fields=BotScore,BotScoreSrc,CacheCacheStatus,CacheResponseBytes,CacheResponseStatus,CacheTieredFill,ClientASN,ClientCountry,ClientDeviceType,ClientIP,ClientIPClass,ClientRequestBytes,ClientRequestHost,ClientRequestMethod,ClientRequestPath,ClientRequestProtocol,ClientRequestReferer,ClientRequestURI,ClientRequestUserAgent,ClientSSLCipher,ClientSSLProtocol,ClientSrcPort,ClientXRequestedWith,EdgeColoCode,EdgeColoID,EdgeEndTimestamp,EdgePathingOp,EdgePathingSrc,EdgePathingStatus,EdgeRateLimitAction,EdgeRateLimitID,EdgeRequestHost,EdgeResponseBytes,EdgeResponseCompressionRatio,EdgeResponseContentType,EdgeResponseStatus,EdgeServerIP,EdgeStartTimestamp,FirewallMatchesActions,FirewallMatchesRuleIDs,FirewallMatchesSources,OriginIP,OriginResponseBytes,OriginResponseHTTPExpires,OriginResponseHTTPLastModified,OriginResponseStatus,OriginResponseTime,OriginSSLProtocol,ParentRayID,RayID,SecurityLevel,WAFAction,WAFFlags,WAFMatchedVar,WAFProfile,WAFRuleID,WAFRuleMessage,WorkerCPUTime,WorkerStatus,WorkerSubrequest,WorkerSubrequestCount,ZoneID&timestamps=unixnano",
    "destination_conf": "https://your.example.workers.dev?header_Authorization=Basic%20dXNlcm5hbWU6cGFzc3dvcmQK&job=lokiJobName",
    "max_upload_bytes": 5000000,
    "max_upload_records": 1000,
    "dataset": "http_requests",
    "frequency": "high",
    "enabled": true
}'
```

- please make sure to update the following fields in the curl request above:
- your own zone id instead of `<zone id>`
- your own **API Key** and/or E-Mail and Global API Key
- You might want to update the `logpull_options` (check API Docs)
- **destination_conf** enter your own workers domain in there, but **keep** the `?header_Authorization=Basic%20`, just update the `Authorization` header with your own username and password
- Update the **job** query string to the stream name you want to see in Grafana later on.

If everything went according to plan, you should see your new Logpush Job in [the Analytics => Log tab](https://dash.cloudflare.com/?to=/:account/:zone/analytics/logs) as well as in Grafana Loki. This is how it could look like.

## Debugging

The initial creation of the logpush job will push one json line to Loki, you should see something along the lines:

```
{"content": "test", "filename": "test.txt"}
```

in your Loki logs.

## Todo / Improvements

- Create some nice sample Dashboards to make sense out of the data
- Error Handling 🤷‍♂️
