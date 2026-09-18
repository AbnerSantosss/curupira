param([int]$Port = 3000)

# Aguarda o servidor do Next.js subir e entao abre o navegador.
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $Port)
        $client.Close()
        Start-Sleep -Milliseconds 700
        Start-Process "http://localhost:$Port"
        exit 0
    } catch {
        Start-Sleep -Milliseconds 500
    } finally {
        $client.Dispose()
    }
}
exit 1
