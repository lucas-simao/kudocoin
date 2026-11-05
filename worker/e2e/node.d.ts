// The few Node APIs the fake Slack uses. The Worker's types are Cloudflare's, without Node's, and the end-to-end
// tests run in Node, so these are declared here rather than adding @types/node for one file.
declare module 'node:crypto' {
  export function createHmac(algorithm: string, key: string): { update(data: string): { digest(encoding: 'hex'): string } }
}

declare module 'node:http' {
  export interface IncomingMessage {
    url?: string
    headers: Record<string, string | undefined>
    on(event: 'data', listener: (chunk: string) => void): void
    on(event: 'end', listener: () => void): void
  }
  export interface ServerResponse {
    statusCode: number
    setHeader(name: string, value: string): void
    end(body?: string): void
  }
  export interface Server {
    listen(port: number, host: string, callback: () => void): void
    close(callback: () => void): void
  }
  export function createServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Server
}
