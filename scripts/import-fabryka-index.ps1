$ErrorActionPreference = 'Stop'
$origin = 'https://www.fabrykasily.pl'
$index = Invoke-WebRequest -Uri "$origin/atlas-cwiczen" -UseBasicParsing -TimeoutSec 30
$categories = @($index.Links | Where-Object { $_.class -match 'fs-atlas__category' } | ForEach-Object { $_.href } | Sort-Object -Unique)
$categories += '/cwiczenia/dla-kobiet'
$items = @{}
foreach ($category in ($categories | Sort-Object -Unique)) {
    $response = Invoke-WebRequest -Uri ($origin + $category) -UseBasicParsing -TimeoutSec 30
    foreach ($link in $response.Links) {
        if ($link.class -notmatch 'fs-atlas__exercise' -or $link.href -notmatch '^/(?:atlas-cwiczen|cwiczenia)/[^/]+/[^/]+$') { continue }
        $match = [regex]::Match($link.outerHTML, '<span\s+class="fa exercise-text">([^<]+)</span>')
        if (-not $match.Success) { continue }
        $title = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value).Trim()
        if (-not $title) { continue }
        $url = $origin + $link.href
        if (-not $items.ContainsKey($url)) { $items[$url] = [ordered]@{ title = $title; url = $url; category = $category } }
    }
    Start-Sleep -Milliseconds 300
}
$output = Join-Path (Split-Path $PSScriptRoot -Parent) 'src/data/fabryka-index.json'
$items.Values | Sort-Object title, url | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $output -Encoding UTF8
Write-Output "Zapisano $($items.Count) tytułów i odnośników do $output"
