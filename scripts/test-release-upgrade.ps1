$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$workspace=Split-Path $appRoot -Parent
$taskTools=Join-Path $workspace '.tools'
$env:JAVA_HOME=(Get-ChildItem (Join-Path $taskTools 'java') -Directory|Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $taskTools 'android-sdk'
$env:GRADLE_USER_HOME=Join-Path $taskTools 'gradle'
$adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$serial='emulator-5556'
if((& $adb -s $serial shell getprop ro.kernel.qemu).Trim() -ne '1'){throw 'Disposable emulator required.'}
$secure=(Get-Content -LiteralPath (Join-Path $taskTools 'signing/password.dpapi') -Raw).Trim()|ConvertTo-SecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {$env:FORMA_TEST_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
Push-Location $appRoot
try {
  & './android/gradlew.bat' -p android :app:assembleDebugAndroidTest --quiet --console=plain
  if($LASTEXITCODE){throw 'Test compilation failed'}
  $signer=Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/apksigner.bat'
  $testAPK=Join-Path $taskTools 'release-instrumentation.apk'
  & $signer sign --ks (Join-Path $taskTools 'signing/forma-release.jks') --ks-key-alias forma --ks-pass env:FORMA_TEST_KEY --key-pass env:FORMA_TEST_KEY --out $testAPK 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
  if($LASTEXITCODE){throw 'Test signing failed'}
  & $adb -s $serial uninstall pl.forma.dziennik.test
  & $adb -s $serial uninstall pl.forma.dziennik
  & $adb -s $serial install (Join-Path $workspace 'wydanie/FORMA-0.4.0.apk')
  if($LASTEXITCODE){throw 'Old release installation failed'}
  & $adb -s $serial install $testAPK
  if($LASTEXITCODE){throw 'Test installation failed'}
  function Run-Scenario([string]$method){
    $instrumentArgs=@('-s',$serial,'shell','am','instrument','-w','-e','class',"pl.forma.dziennik.RealUseTest#$method")
    if($method -eq 'g_liveCloudBackupAndRestore'){
      $fixture=@(Get-Content (Join-Path $taskTools 'firebase-test-accounts.json') -Raw | ConvertFrom-Json)[0]
      if($fixture.email -notlike 'forma-test-*@example.test'){throw 'Reserved synthetic fixture required'}
      $instrumentArgs+=@('-e','cloudEmail',$fixture.email,'-e','cloudPassword',$fixture.password)
    }
    $instrumentArgs+='pl.forma.dziennik.test/androidx.test.runner.AndroidJUnitRunner'
    $result=& $adb @instrumentArgs
    $result|Write-Output
    if(($result -join "`n") -notmatch 'OK \(1 test\)'){throw "Scenario failed: $method"}
  }
  Run-Scenario 'f_prepareLegacyFixture'
  & $adb -s $serial shell am force-stop pl.forma.dziennik
  $version=(Get-Content (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
  & $adb -s $serial install -r (Join-Path $workspace "wydanie/FORMA-$version.apk")
  if($LASTEXITCODE){throw 'Release update failed'}
  & $adb -s $serial shell pm grant pl.forma.dziennik android.permission.POST_NOTIFICATIONS
  Run-Scenario 'c_verifyAfterProcessDeath'
  Run-Scenario 'd_importedTextAndLinkSecurity'
  Run-Scenario 'm_backgroundWorkoutNotificationControls'
  Run-Scenario 'n_trainingRowsAndBundledPhotos'
  if(Test-Path (Join-Path $taskTools 'firebase-test-accounts.json')){Run-Scenario 'g_liveCloudBackupAndRestore'}
} finally {Pop-Location;Remove-Item Env:FORMA_TEST_KEY}
