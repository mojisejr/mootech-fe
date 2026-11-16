import net from 'node:net'

/** A loopback-only fault fixture; it never observes real credentials or customer queries. */
export function stallProxy(target: URL) {
  const targetPort = Number(target.port)
  const targetHost = target.hostname
  const open = new Set<{ client: net.Socket; server: net.Socket; silent: boolean; hideReplies: boolean }>()
  let loseCommitResponse = false
  let commitsObserved = 0
  const listener = net.createServer((client) => {
    const pair = { client, server: net.connect(targetPort, targetHost), silent: false, hideReplies: false }
    open.add(pair)
    client.on('data', (chunk) => {
      if (pair.silent) return
      // The fixture disables TLS; COMMIT is emitted as one small protocol message by postgres.js.
      // The test separately asserts this hook fired and the marker really committed.
      if (loseCommitResponse && /\bcommit\b/i.test(chunk.toString('utf8'))) {
        commitsObserved++
        pair.hideReplies = true
      }
      pair.server.write(chunk)
    })
    pair.server.on('data', (chunk) => { if (!pair.silent && !pair.hideReplies) client.write(chunk) })
    const close = () => { open.delete(pair); client.destroy(); pair.server.destroy() }
    client.on('close', close).on('error', close)
    pair.server.on('close', close).on('error', close)
  })
  return {
    listen: () => new Promise<number>((resolve) => listener.listen(0, '127.0.0.1', () => resolve((listener.address() as net.AddressInfo).port))),
    silenceOpenConnections: () => { for (const pair of open) pair.silent = true; return open.size },
    loseCommitResponse: () => { loseCommitResponse = true },
    commitsObserved: () => commitsObserved,
    close: () => { for (const pair of open) { pair.client.destroy(); pair.server.destroy() }; listener.close() },
  }
}
