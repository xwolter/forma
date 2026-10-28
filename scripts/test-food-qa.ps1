param([string]$StartAt='')
$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$toolsRoot=Join-Path (Split-Path $appRoot -Parent) '.tools'
$env:JAVA_HOME=(Get-ChildItem (Join-Path $toolsRoot 'java') -Directory|Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $toolsRoot 'android-sdk'
$env:GRADLE_USER_HOME=Join-Path $toolsRoot 'gradle'
$adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$serial='emulator-5556'
if((& $adb -s $serial shell getprop ro.kernel.qemu).Trim() -ne '1'){throw 'Only the disposable emulator can run this test.'}
Push-Location $appRoot
try {
  & npm.cmd run build
  if($LASTEXITCODE){throw 'Build failed'}
  & npx.cmd cap sync android
  & './android/gradlew.bat' -p android :app:assembleDebug :app:assembleDebugAndroidTest '-PformaApplicationId=pl.forma.dziennik.qa' --console=plain --quiet
  if($LASTEXITCODE){throw 'QA build failed'}
  & $adb -s $serial install -r 'android/app/build/outputs/apk/debug/app-debug.apk'
  if($LASTEXITCODE){throw 'QA install failed'}
  & $adb -s $serial install -r 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
  if($LASTEXITCODE){throw 'QA tests install failed'}
  & $adb -s $serial shell pm clear pl.forma.dziennik.qa
  & $adb -s $serial shell pm grant pl.forma.dziennik.qa android.permission.POST_NOTIFICATIONS
  function Run-Scenario([string]$name){
    if($StartAt -and !$script:started -and $name -ne 'a_realisticDayFoodWorkoutPersistenceAndSecurity'){if($name -ne $StartAt){return};$script:started=$true}
    $result=& $adb -s $serial shell am instrument -w -e class "pl.forma.dziennik.RealUseTest#$name" pl.forma.dziennik.qa.test/androidx.test.runner.AndroidJUnitRunner
    $result|Write-Output
    if(($result -join "`n") -notmatch 'OK \(1 test\)'){throw "Scenario failed: $name"}
  }
  Run-Scenario 'a_realisticDayFoodWorkoutPersistenceAndSecurity'
  Run-Scenario 's_foodScannerAndIdentity'
  Run-Scenario 'i_recipeIngredientsValidationUndoAndHistory'
  Run-Scenario 'j_streaksCatalogAndFoodShortcuts'
  Run-Scenario 'n_trainingRowsAndBundledPhotos'
  Run-Scenario 'o_homeWeekAndActionCards'
  Run-Scenario 't_homeWeekFoodHistory'
  Run-Scenario 'p_createProgramWithWeeklySetsAndTimedExercise'
  Run-Scenario 'k_waterCorrectionsAndActualWidgetControls'
  Run-Scenario 'm_backgroundWorkoutNotificationControls'
  Run-Scenario 'u_trainingAuditAndUndo'
  Run-Scenario 'v_nativeWidgetAppearance'
} finally {Pop-Location}
