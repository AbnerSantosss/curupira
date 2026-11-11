param([int]$Port = 3000, [int]$Tries = 20)

# Escolhe a porta do CURUPIRA a partir de $Port e responde em uma linha:
#   RUNNING <porta>  -> o CURUPIRA ja esta aberto nessa porta, basta abrir o navegador
#   START <porta>    -> porta livre, pode subir o servidor nela
# Porta ocupada por outro programa e pulada. Sem acentos de proposito: o
# Windows PowerShell le .ps1 sem BOM como ANSI.

function Test-Curupira([int]$p) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$p/api/health" -UseBasicParsing -TimeoutSec 5
        return $r.Content -match '"outputDir"'
    } catch {
        # Com CURUPIRA_ACCESS_KEY definida a API responde 401 com a mensagem do portao.
        $resp = $_.Exception.Response
        if ($null -eq $resp -or [int]$resp.StatusCode -ne 401) { return $false }
        try {
            $reader = New-Object IO.StreamReader($resp.GetResponseStream())
            return $reader.ReadToEnd() -match 'entre de novo'
        } catch {
            return $false
        }
    }
}

$busy = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
    ForEach-Object { $_.Port }

for ($p = $Port; $p -lt $Port + $Tries; $p++) {
    if ($busy -notcontains $p) {
        Write-Output "START $p"
        exit 0
    }
    if (Test-Curupira $p) {
        Write-Output "RUNNING $p"
        exit 0
    }
}
exit 1
