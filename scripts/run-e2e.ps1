$ErrorActionPreference = "Stop"

$repositoryPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$serverProcess = $null
$testExitCode = 1

Push-Location $repositoryPath
try {
  $env:NEXT_PUBLIC_NIGHTINGALE_MOCK = "true"

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "The production build failed before the browser test."
  }

  $serverProcess = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @(
      "./node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100"
    ) `
    -WorkingDirectory $repositoryPath `
    -WindowStyle Hidden `
    -PassThru

  $serverReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    try {
      $response = Invoke-WebRequest `
        -Uri "http://127.0.0.1:3100" `
        -UseBasicParsing `
        -TimeoutSec 1
      if ($response.StatusCode -eq 200) {
        $serverReady = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $serverReady) {
    throw "The temporary browser-test server did not start."
  }

  & (Join-Path $repositoryPath "node_modules/.bin/playwright.cmd") test
  $testExitCode = $LASTEXITCODE
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
    $serverProcess.WaitForExit()
  }
  Pop-Location
}

exit $testExitCode
