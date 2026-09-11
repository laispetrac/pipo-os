import { createRequire } from 'node:module'
import pino, { type LoggerOptions } from 'pino'
import { PII_QUERY_PARAMS, PII_REDACT_PATHS, REDACTED } from './redact.js'

const require = createRequire(import.meta.url)

interface RequestLike {
  method: string
  url: string
  hostname?: string
  ip?: string
  headers: Record<string, unknown>
}

interface ReplyLike {
  statusCode: number
}

/** Rewritten only when a redacted parameter is actually there, so every other
 *  line keeps the caller's own spelling instead of URLSearchParams'. */
export function redactUrl(url: string): string {
  const cut = url.indexOf('?')
  if (cut === -1) return url

  const params = new URLSearchParams(url.slice(cut + 1))
  const present = PII_QUERY_PARAMS.filter((name) => params.has(name))
  if (present.length === 0) return url

  for (const name of present) params.set(name, REDACTED)
  // `toString` escapes the brackets, and a redaction has to stay greppable.
  const query = params.toString().replaceAll(encodeURIComponent(REDACTED), REDACTED)
  return `${url.slice(0, cut)}?${query}`
}

function requestSerializer(request: RequestLike) {
  return {
    method: request.method,
    url: redactUrl(request.url),
    hostname: request.hostname,
    ip: request.ip,
    headers: request.headers,
  }
}

function responseSerializer(reply: ReplyLike) {
  return { statusCode: reply.statusCode }
}

export interface CreateLoggerOptionsInput {
  level?: string
  nodeEnv?: string
  additionalRedactPaths?: readonly string[]
}

export function createLoggerOptions(input: CreateLoggerOptionsInput = {}): LoggerOptions {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? 'development'
  const level =
    input.level ?? process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug')

  const options: LoggerOptions = {
    level,
    redact: {
      paths: [...PII_REDACT_PATHS, ...(input.additionalRedactPaths ?? [])],
      censor: REDACTED,
    },
    serializers: {
      req: requestSerializer,
      res: responseSerializer,
      err: pino.stdSerializers.err,
    },
    formatters: {
      // level como string ("info", "error") em vez do número cru do pino: o pipeline
      // de logs (Promtail) não faz esse mapeamento, então sem isso o Grafana não
      // reconhece a severidade da linha.
      level: (label) => ({ level: label }),
      // pid não agrega valor em containers (1 processo por pod); removido por hora.
      bindings: (bindings) => {
        const rest = { ...bindings }
        delete rest.pid
        return rest
      },
    },
  }

  // require.resolve garante que o worker do transport ache pino-pretty mesmo com
  // node_modules estrito do pnpm, independente de onde o app consumidor roda.
  if (nodeEnv === 'development') {
    options.transport = {
      target: require.resolve('pino-pretty'),
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    }
  }

  return options
}
