$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
$workspace = Split-Path $appRoot -Parent
$toolRoot = Join-Path $workspace '.tools'
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = (Get-ChildItem -LiteralPath (Join-Path $toolRoot 'java') -Directory | Select-Object -First 1).FullName }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk' }
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle'
$signingRoot = Join-Path $toolRoot 'signing'
$outputRoot = Join-Path $workspace 'wydanie'
New-Item -ItemType Directory -Path $signingRoot,$outputRoot -Force | Out-Null
$keyPath = Join-Path $signingRoot 'forma-release.jks'
$passwordPath = Join-Path $signingRoot 'password.dpapi'
if (-not (Test-Path -LiteralPath $passwordPath)) {
    $keyPassword = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    ConvertTo-SecureString $keyPassword -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordPath -Encoding UTF8
} else {
    $securePassword = (Get-Content -LiteralPath $passwordPath -Raw).Trim() | ConvertTo-SecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try { $keyPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
}
$env:FORMA_KEY_PASS = $keyPassword
try {
    if (-not (Test-Path -LiteralPath $keyPath)) {
        & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -noprompt -keystore $keyPath -storetype JKS -alias forma -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=FORMA Private, OU=Mobile, O=FORMA, C=PL' -storepass:env FORMA_KEY_PASS -keypass:env FORMA_KEY_PASS
        if ($LASTEXITCODE -ne 0) { throw 'Nie udało się przygotować podpisu.' }
    }
    Push-Location $appRoot
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Budowa aplikacji nie powiodła się.' }
        & npx.cmd cap sync android
        if ($LASTEXITCODE -ne 0) { throw 'Synchronizacja Androida nie powiodła się.' }
        'sdk.dir=' + $env:ANDROID_HOME.Replace('\','/') | Set-Content -LiteralPath (Join-Path $appRoot 'android\local.properties') -Encoding ASCII
        Push-Location (Join-Path $appRoot 'android')
        try {
            & '.\gradlew.bat' :app:assembleRelease --console=plain --quiet
            if ($LASTEXITCODE -ne 0) { throw 'Kompilacja Androida nie powiodła się.' }
        } finally { Pop-Location }
        $buildTools = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'
        $unsigned = Join-Path $appRoot 'android\app\build\outputs\apk\release\app-release-unsigned.apk'
        $aligned = Join-Path $outputRoot 'FORMA-aligned.apk'
        $appVersion = (Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
        $signed = Join-Path $outputRoot "FORMA-$appVersion.apk"
        & (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsigned $aligned
        if ($LASTEXITCODE -ne 0) { throw 'Przygotowanie APK nie powiodło się.' }
        & (Join-Path $buildTools 'apksigner.bat') sign --ks $keyPath --ks-key-alias forma --ks-pass env:FORMA_KEY_PASS --key-pass env:FORMA_KEY_PASS --out $signed $aligned
        if ($LASTEXITCODE -ne 0) { throw 'Podpisanie APK nie powiodło się.' }
        & (Join-Path $buildTools 'apksigner.bat') verify --verbose $signed
        if ($LASTEXITCODE -ne 0) { throw 'Podpis APK nie przeszedł weryfikacji.' }
        Remove-Item -LiteralPath $aligned
        $sha = (Get-FileHash -LiteralPath $signed -Algorithm SHA256).Hash
        ($sha + "  FORMA-$appVersion.apk") | Set-Content -LiteralPath (Join-Path $outputRoot "SHA256-$appVersion.txt") -Encoding ASCII
        Get-Item -LiteralPath $signed | Select-Object Name,Length,FullName
    } finally { Pop-Location }
} finally { Remove-Item Env:FORMA_KEY_PASS; $keyPassword = $null }
