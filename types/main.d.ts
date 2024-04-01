import { Writable, Readable } from "stream"
import { EventEmitter } from "events"

interface IClientOptions {
  host: string
  port: number
  sockFile: string
  maxConns: number
  maxReqs: number
  mpxsConns: number
  skipCheckServer: boolean
}

interface IRequestOptions {
  QUERY_STRING: string
  REQUEST_METHOD: string
  CONTENT_TYPE: string
  CONTENT_LENGTH: string
  SCRIPT_FILENAME: string
  SCRIPT_NAME: string
  REQUEST_URI: string
  DOCUMENT_URI: string
  DOCUMENT_ROOT: string
  SERVER_PROTOCOL: string
  GATEWAY_INTERFACE: string
  REMOTE_ADDR: string
  REMOTE_PORT: number
  SERVER_ADDR: string
  SERVER_PORT: number
  SERVER_NAME: string
  REDIRECT_STATUS: number
}

interface IClient extends EventEmitter {
  request: (
    options: Partial<IRequestOptions>,
    callback: (error: Error | null, request: {
      abort(): void,
      stdin: Writable,
      stdout: Readable,
      stderr: Readable,
      getExitStatus(): Error | number
    }) => void
  ) => void
}

export default function createClient(options?: Partial<IClientOptions>): IClient
