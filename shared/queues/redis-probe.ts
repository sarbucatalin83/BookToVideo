import net from 'net'

export function probeRedis(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const { hostname: host, port: portStr } = new URL(url)
    const port = parseInt(portStr || '6379', 10)
    const socket = net.createConnection({ port, host })
    const timer = setTimeout(() => { socket.destroy(); resolve(false) }, timeoutMs)
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true) })
    socket.on('error', () => { clearTimeout(timer); resolve(false) })
  })
}
