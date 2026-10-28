param([switch]$InstalledClient,[switch]$ResumeDownload,[switch]$VerifyInstalled)
$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$workspace=Split-Path $appRoot -Parent
$toolRoot=Join-Path $workspace '.tools'
$releaseVersion=(Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw|ConvertFrom-Json).version
$releaseCode=[regex]::Match((Get-Content -LiteralPath (Join-Path $appRoot 'android/app/build.gradle') -Raw),'formaVersionCode"\) \?: "(\d+)"').Groups[1].Value
$env:JAVA_HOME=(Get-ChildItem (Join-Path $toolRoot 'java') -Directory|Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $toolRoot 'android-sdk'
$env:GRADLE_USER_HOME=Join-Path $toolRoot 'gradle'
$adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$serial='emulator-5556'
if((& $adb -s $serial shell getprop ro.kernel.qemu).Trim() -ne '1'){throw 'Disposable emulator required'}
$secure=(Get-Content -LiteralPath (Join-Path $toolRoot 'signing/password.dpapi') -Raw).Trim()|ConvertTo-SecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$env:FORMA_TEST_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
Push-Location $appRoot
try{
 $signer=Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/apksigner.bat'
 $align=Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/zipalign.exe'
 $key=Join-Path $toolRoot 'signing/forma-release.jks'
 $releaseSha=(Get-FileHash -LiteralPath (Join-Path $workspace "wydanie/FORMA-$releaseVersion.apk") -Algorithm SHA256).Hash.ToLowerInvariant()
 function Run-Scenario([string]$test){
  $result=& $adb -s $serial shell am instrument -w -e releaseVersion $releaseVersion -e releaseCode $releaseCode -e releaseSha $releaseSha -e class "pl.forma.dziennik.RealUseTest#$test" pl.forma.dziennik.test/androidx.test.runner.AndroidJUnitRunner
  $result|Write-Output
  if(($result -join "`n") -notmatch 'OK \(1 test\)'){throw "Scenario failed: $test"}
 }
 if($InstalledClient){
  & './android/gradlew.bat' -p android :app:assembleDebugAndroidTest --quiet --console=plain
  if($LASTEXITCODE){throw 'Patch tests build failed'}
  $testAPK=Join-Path $toolRoot 'release-instrumentation.apk'
  & $signer sign --ks $key --ks-key-alias forma --ks-pass env:FORMA_TEST_KEY --key-pass env:FORMA_TEST_KEY --out $testAPK 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
  if($LASTEXITCODE){throw 'Patch tests signing failed'}
  & $adb -s $serial install -r $testAPK
  if($LASTEXITCODE){throw 'Patch tests installation failed'}
  if(!$VerifyInstalled){
  if(!$ResumeDownload){Run-Scenario 'b_prepareWorkoutForProcessDeath'}
  Run-Scenario 'r_downloadUpdateFromInstalledVersion'
  & $adb -s $serial shell am force-stop pl.forma.dziennik
  & $adb -s $serial install -r (Join-Path $workspace "wydanie/FORMA-$releaseVersion.apk")
  if($LASTEXITCODE){throw 'Patch installation failed'}
  Run-Scenario 'c_verifyAfterProcessDeath'
  }
  Run-Scenario 'n_trainingRowsAndBundledPhotos'
  Run-Scenario 'o_homeWeekAndActionCards'
  Run-Scenario 'v_nativeWidgetAppearance'
  Run-Scenario 'w_homeLayoutProof'
  Run-Scenario 'x_remoteProductImagePolicy'
  return
 }

 & './android/gradlew.bat' -p android :app:assembleRelease '-PformaVersionCode=5' '-PformaVersionName=0.5.0' --quiet --console=plain
 if($LASTEXITCODE){throw 'Update client build failed'}
 $aligned=Join-Path $toolRoot 'update-client-aligned.apk'
 $client=Join-Path $toolRoot 'update-client-4.apk'
 & $align -f -p 4 'android/app/build/outputs/apk/release/app-release-unsigned.apk' $aligned
 & $signer sign --ks $key --ks-key-alias forma --ks-pass env:FORMA_TEST_KEY --key-pass env:FORMA_TEST_KEY --out $client $aligned
 if($LASTEXITCODE){throw 'Update client signing failed'}
 & './android/gradlew.bat' -p android :app:assembleDebug "-PformaVersionCode=$([int]$releaseCode+1)" --quiet --console=plain
 if($LASTEXITCODE){throw 'Wrong signature fixture build failed'}
 $wrongSigner=Join-Path $toolRoot 'update-wrong-signature.apk'
 Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $wrongSigner -Force
 $assetRoot=Join-Path $toolRoot 'update-test-assets'
 $fixtureAssets=Join-Path $assetRoot 'update-fixtures'
 New-Item -ItemType Directory -Path $fixtureAssets -Force|Out-Null
 Copy-Item -LiteralPath (Join-Path $workspace "wydanie/FORMA-$releaseVersion.apk") -Destination (Join-Path $fixtureAssets 'release.apk') -Force
 Copy-Item -LiteralPath (Join-Path $workspace 'wydanie/FORMA-0.4.0.apk') -Destination (Join-Path $fixtureAssets 'old.apk') -Force
 Copy-Item -LiteralPath $wrongSigner -Destination (Join-Path $fixtureAssets 'wrong-signature.apk') -Force
 if(!(Test-Path -LiteralPath (Join-Path $fixtureAssets 'wrong-package.apk'))){Copy-Item -LiteralPath (Join-Path $toolRoot 'release-instrumentation.apk') -Destination (Join-Path $fixtureAssets 'wrong-package.apk')}
 & './android/gradlew.bat' -p android :app:assembleDebugAndroidTest "-PformaUpdateFixtures=$assetRoot" --quiet --console=plain
 if($LASTEXITCODE){throw 'Update tests build failed'}
 $testAPK=Join-Path $toolRoot 'release-instrumentation.apk'
 & $signer sign --ks $key --ks-key-alias forma --ks-pass env:FORMA_TEST_KEY --key-pass env:FORMA_TEST_KEY --out $testAPK 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
 if($LASTEXITCODE){throw 'Update tests signing failed'}
 & $adb -s $serial uninstall pl.forma.dziennik.test
 & $adb -s $serial uninstall pl.forma.dziennik
 & $adb -s $serial install $client
 if($LASTEXITCODE){throw 'Update client installation failed'}
 & $adb -s $serial install $testAPK
 & $adb -s $serial shell pm grant pl.forma.dziennik android.permission.POST_NOTIFICATIONS
 & $adb -s $serial shell appops set pl.forma.dziennik REQUEST_INSTALL_PACKAGES allow
 Run-Scenario 'a_realisticDayFoodWorkoutPersistenceAndSecurity'
 Run-Scenario 'o_homeWeekAndActionCards'
 Run-Scenario 'p_createProgramWithWeeklySetsAndTimedExercise'
 Run-Scenario 'b_prepareWorkoutForProcessDeath'
 Run-Scenario 'q_publicUpdateDownloadAndNativeValidation'
 & $adb -s $serial shell am force-stop pl.forma.dziennik
 & $adb -s $serial install -r (Join-Path $workspace "wydanie/FORMA-$releaseVersion.apk")
 if($LASTEXITCODE){throw 'Final update installation failed'}
 Run-Scenario 'c_verifyAfterProcessDeath'
 Run-Scenario 'n_trainingRowsAndBundledPhotos'
}finally{Pop-Location;Remove-Item Env:FORMA_TEST_KEY}
