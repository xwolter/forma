$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$toolRoot=Join-Path (Split-Path $appRoot -Parent) '.tools'
$env:JAVA_HOME=(Get-ChildItem (Join-Path $toolRoot 'java') -Directory|Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $toolRoot 'android-sdk'
$env:GRADLE_USER_HOME=Join-Path $toolRoot 'gradle'
$adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$serial='emulator-5556'
if((& $adb -s $serial shell getprop ro.kernel.qemu).Trim() -ne '1'){throw 'Tests can only run on the disposable Android emulator.'}
Push-Location $appRoot
try {
  & npm.cmd run build
  if($LASTEXITCODE){throw 'Build failed'}
  & npx.cmd cap sync android
  & './android/gradlew.bat' -p android :app:assembleDebug :app:assembleDebugAndroidTest --console=plain --quiet
  if($LASTEXITCODE){throw 'Android build failed'}
  & $adb -s $serial uninstall pl.forma.dziennik.test
  & $adb -s $serial uninstall pl.forma.dziennik
  & $adb -s $serial install -r 'android/app/build/outputs/apk/debug/app-debug.apk'
  if($LASTEXITCODE){throw 'APK install failed'}
  & $adb -s $serial install -r 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
  if($LASTEXITCODE){throw 'Test APK install failed'}
  # Only the disposable emulator fixture is cleared; never a physical device.
  & $adb -s $serial shell pm clear pl.forma.dziennik
  & $adb -s $serial shell pm grant pl.forma.dziennik android.permission.POST_NOTIFICATIONS
  function Invoke-Scenario([string]$method){
    $output=& $adb -s $serial shell am instrument -w -e class "pl.forma.dziennik.RealUseTest#$method" pl.forma.dziennik.test/androidx.test.runner.AndroidJUnitRunner
    $output|Write-Output
    if(($output -join "`n") -notmatch 'OK \(1 test\)'){throw "Scenario failed: $method"}
  }
  Invoke-Scenario 'a_realisticDayFoodWorkoutPersistenceAndSecurity'
  Invoke-Scenario 'b_prepareWorkoutForProcessDeath'
  & $adb -s $serial shell am force-stop pl.forma.dziennik
  & $adb -s $serial shell svc wifi disable
  & $adb -s $serial shell svc data disable
  try {Invoke-Scenario 'c_verifyAfterProcessDeath'}
  finally {& $adb -s $serial shell svc wifi enable;& $adb -s $serial shell svc data enable}
  Invoke-Scenario 'd_importedTextAndLinkSecurity'
  Invoke-Scenario 'e_externalApplicationHandoffs'
  Invoke-Scenario 'h_draftsPinnedNotesWarmupsAndCopy'
  Invoke-Scenario 'i_recipeIngredientsValidationUndoAndHistory'
  Invoke-Scenario 'j_streaksCatalogAndFoodShortcuts'
  Invoke-Scenario 'k_waterCorrectionsAndActualWidgetControls'
  Invoke-Scenario 'm_backgroundWorkoutNotificationControls'
  Invoke-Scenario 'n_trainingRowsAndBundledPhotos'
} finally {Pop-Location}
