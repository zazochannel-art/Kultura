# Start a simple local web server to preview the static site
param(
    [int]$Port = 8000
)

Write-Host "Starting local web server at http://localhost:$Port/ (Ctrl+C to stop)"

if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $Port --directory (Split-Path -Parent $MyInvocation.MyCommand.Path)
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -m http.server $Port --directory (Split-Path -Parent $MyInvocation.MyCommand.Path)
} else {
    Write-Host "Python not found. You can serve this folder with any static server. Open index.html directly in a browser as fallback." -ForegroundColor Yellow
}

