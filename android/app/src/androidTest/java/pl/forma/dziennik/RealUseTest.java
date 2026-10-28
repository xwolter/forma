package pl.forma.dziennik;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.FixMethodOrder;
import org.junit.runners.MethodSorters;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import androidx.test.espresso.intent.Intents;
import android.app.Instrumentation;
import android.app.Activity;
import android.content.Intent;
import static androidx.test.espresso.intent.matcher.IntentMatchers.*;
import static androidx.test.espresso.intent.Intents.*;
import static org.hamcrest.Matchers.allOf;
import static org.junit.Assert.*;

/** Exercises the rendered UI in the actual Android WebView. No production test bridge. */
@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class RealUseTest {
  private ActivityScenario<MainActivity> scenario;
  private void awake(boolean expected) throws Exception {
    AtomicReference<Boolean> flag=new AtomicReference<>(!expected);
    long end=System.currentTimeMillis()+3000;
    while(System.currentTimeMillis()<end){
      scenario.onActivity(a->flag.set((a.getWindow().getAttributes().flags & android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)!=0));
      if(flag.get()==expected)return;
      Thread.sleep(100);
    }
    fail("Keep awake expected: "+expected);
  }
  @Test public void f_prepareLegacyFixture() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('button')");
      if(js("return document.body.innerText.includes('Obejrzyj wersję demo')").equals("true"))click("Obejrzyj wersję demo");
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Trening");js("document.querySelector('button[aria-label^=\"Rozpocznij \"]').click();return true");
      until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");
      fill("Ciężar serii 1","55");fill("Powtórzenia serii 1","12");click("Zapisz serię 1");until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
    } finally {scenario.close();}
  }
  @Test public void e_externalApplicationHandoffs() throws Exception {
    Intents.init();
    intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Spotify");
      Thread.sleep(600);
      intended(allOf(hasAction(Intent.ACTION_VIEW),hasData("https://open.spotify.com/genre/workout-page")));
      click("Trening");click("Ćwiczenia");
      js("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Wyciskanie sztangi leżąc')).click();return true");
      until("document.body.innerText.includes('Obejrzyj w YouTube')");click("Obejrzyj w YouTube");Thread.sleep(600);
      intended(allOf(hasAction(Intent.ACTION_VIEW),hasData("https://www.youtube.com/watch?v=rT7DgCr-3pg")));
      click("Zamknij");
      click("Moje plany");startFirstPlan();
      until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");awake(true);
      click("Spotify");Thread.sleep(300);
      int musicIntents=0;for(Intent intent:Intents.getIntents())if("https://open.spotify.com/genre/workout-page".equals(intent.getDataString()))musicIntents++;
      assertEquals("Spotify from active workout",2,musicIntents);
      click("Pauza");awake(false);click("Zakończ");click("Zakończ i zapisz");
    } finally {scenario.close();Intents.release();}
  }
  @Test public void b_prepareWorkoutForProcessDeath() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Trening");
      startFirstPlan();
      until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");
      fill("Ciężar serii 1","55");fill("Powtórzenia serii 1","12");
      click("Zapisz serię 1");
      until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
    } finally {scenario.close();}
  }
  @Test public void c_verifyAfterProcessDeath() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      openSavedWorkout();
      until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
      assertEquals("55",js("return document.querySelector('[aria-label=\"Ciężar serii 1\"]').value"));
      assertEquals("12",js("return document.querySelector('[aria-label=\"Powtórzenia serii 1\"]').value"));
      click("Zakończ");click("Zakończ i zapisz");until("(document.querySelector('.page-title h1')?.textContent==='Trening'||document.body.innerText.includes('Twój trening.'))");
    } finally {scenario.close();}
  }
  private void startFirstPlan() throws Exception {
    js("document.querySelector('.plan-open').click();return true");until("document.querySelector('dialog[open]')");click("Rozpocznij trening");
  }
  private void proofScreen(String name) throws Exception {
    InstrumentationRegistry.getInstrumentation().waitForIdleSync();Thread.sleep(400);
    android.graphics.Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
    assertNotNull(image);try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(target().getExternalFilesDir(null),name))){image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}image.recycle();
  }
  @Test public void y_reductionLibraryAndCompactNutrition() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");click("Trening");click("Ćwiczenia");click("Na początek");until("document.querySelectorAll('.exercise-list .list-row').length===24");proofScreen("FORMA-cwiczenia-0.7.2.png");
      click("Cardio");until("document.querySelectorAll('.exercise-list .list-row').length===28");fill("Szukaj ćwiczenia","bicycling stationary");until("document.querySelectorAll('.exercise-list .list-row').length===1");js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('.exercise-frames img')?.naturalWidth>0");click("2 · Widok");until("document.querySelector('.exercise-frames img').getAttribute('src').endsWith('/1.jpg')&&document.querySelector('.exercise-frames img').naturalWidth>0");click("Zamknij");
      click("Moje plany");click("Utwórz plan");fill("Nazwa treningu","Rower — test 0.7.2");click("Dodaj ćwiczenie");fill("Szukaj ćwiczenia","bicycling stationary");js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('[aria-label=\"Sekundy od\"]')||[...document.querySelectorAll('label')].some(l=>l.innerText.includes('Sekundy od'))");
      assertEquals("Bike is one timed interval","1",js("return [...document.querySelectorAll('label')].find(l=>l.innerText.trim()==='Serie').querySelector('input').value"));assertEquals("Ten minutes stored as seconds","600",js("return [...document.querySelectorAll('label')].find(l=>l.innerText.trim()==='Sekundy od').querySelector('input').value"));click("Zapisz plan");until("!document.querySelector('dialog[open]')");click("Zobacz plan: Rower — test 0.7.2");until("document.querySelector('.plan-exercise-preview')");click("Rozpocznij trening");until("document.querySelector('[aria-label=\"Sekundy serii 1\"]')");fill("Sekundy serii 1","600");click("Zapisz serię 1");until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");click("Zakończ");click("Zakończ i zapisz");until("document.querySelector('.plan-open')");
      click("Dzisiaj");until("document.querySelector('.nutrition-compact')");assertEquals("Nutrition stays compact","true",js("return document.querySelector('.nutrition-compact').getBoundingClientRect().height<240"));assertEquals("Nutrition has six visible icons","6",js("return document.querySelector('.nutrition-compact').querySelectorAll('svg').length"));
      js("document.querySelector('.nutrition-compact').scrollIntoView({block:'center'});return true");proofScreen("FORMA-kalorie-0.7.2.png");click("Dodaj jedzenie");until("document.querySelector('dialog[open]')");click("Zamknij");
      assertEquals("Both footer actions stay in one row","true",js("const a=document.querySelector('.home-calculators').getBoundingClientRect(),b=document.querySelector('.daily-completion-card').getBoundingClientRect();return Math.abs(a.top-b.top)<1&&a.right<=b.left&&Math.abs(a.width-b.width)<1"));js("document.querySelector('.home-footer-actions').scrollIntoView({block:'center'});return true");proofScreen("FORMA-przyciski-0.7.2.png");assertEquals("Phone has no horizontal overflow","true",js("return document.documentElement.scrollWidth<=innerWidth"));
    } finally {scenario.close();}
  }
  @Test public void u_trainingAuditAndUndo() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");click("Trening");click("Ćwiczenia");fill("Szukaj ćwiczenia","sciaganie drazka");until("document.querySelector('.exercise-list').innerText.includes('Ściąganie drążka')");
      fill("Szukaj ćwiczenia","hip thrust");until("document.querySelectorAll('.exercise-list .list-row').length===1");js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('.exercise-frames img')?.naturalWidth>0");click("Uruchom pokaz pozycji");until("document.querySelector('.exercise-frames img').getAttribute('src').endsWith('/1.jpg')");click("Zatrzymaj pokaz pozycji");String stopped=js("return document.querySelector('.exercise-frames img').getAttribute('src')");Thread.sleep(2000);assertEquals(stopped,js("return document.querySelector('.exercise-frames img').getAttribute('src')"));click("Zamknij");
      click("Moje plany");click("Utwórz plan");fill("Nazwa treningu","Audyt czasu i zamiany");click("Dodaj ćwiczenie");fill("Szukaj ćwiczenia","plank bokiem");js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('.plan-editor-item')");fill("Sekundy od","1200");fill("Sekundy do","1800");click("Zapisz plan");until("!document.querySelector('dialog[open]')");
      js("[...document.querySelectorAll('.plan-open')].find(b=>b.innerText.includes('Audyt czasu i zamiany')).click();return true");until("document.querySelector('.plan-exercise-preview')?.innerText.includes('1200–1800 s')");click("Rozpocznij trening");until("document.querySelector('[aria-label=\"Sekundy serii 1\"]')");fill("Sekundy serii 1","1200");click("Zapisz serię 1");until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
      click("Zamień");click("Pełna biblioteka zamienników");fill("Szukaj ćwiczenia","spiecia brzucha lezac");js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('[aria-label=\"Powtórzenia serii 1\"]')");assertEquals("Only the two remaining work sets are replaced","2",js("return document.querySelectorAll('.set-row-wrap').length"));
      for(int i=1;i<=2;i++){fill("Powtórzenia serii "+i,"15");click("Zapisz serię "+i);until("document.querySelector('[aria-label=\"Cofnij serię "+i+"\"]')");}
      click("Zakończ");click("Zakończ i zapisz");until("document.querySelector('.plan-open')");click("Historia");js("document.querySelector('.history-list .list-row').click();return true");until("document.querySelector('dialog[open]')");assertTrue("Completed timed set stays in history",js("return document.querySelector('dialog').innerText").contains("1200 s"));
      js("[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('Plank bokiem')).click();return true");until("document.body.innerText.includes('Popraw wynik serii')");fill("Sekundy","1300");click("Zapisz korektę");until("!document.querySelector('dialog[open]')");
      click("Postępy");fill("Ćwiczenie","side-plank");until("document.querySelector('.chart')");assertTrue("Time chart has seconds",js("return document.body.innerText").contains("Największy zapisany wynik w s"));
      click("Jedzenie");int original=Integer.parseInt(js("return document.querySelector('.water-track').getAttribute('aria-valuenow')"));click("Dodaj 250 ml wody");until("document.querySelector('.toast-undo')");proofScreen("FORMA-komunikat-0.7.png");js("const b=document.querySelector('.toast-undo');b.click();b.click();return true");until("document.querySelector('.water-track').getAttribute('aria-valuenow')==='"+original+"'");assertTrue("Undo success stays readable",js("return document.body.innerText").contains("Cofnięto zmianę"));
    }finally{scenario.close();}
  }
  @Test public void v_nativeWidgetAppearance() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    JSONObject original=WidgetState.snapshot(target());
    try {
      JSONObject sample=new JSONObject().put("configured",true).put("date",WidgetState.today()).put("kcal",1350).put("goal",2400).put("protein",95).put("proteinGoal",150).put("fat",35).put("fatGoal",70).put("carbs",120).put("carbsGoal",290).put("water",1250).put("waterGoal",2500).put("trainingName","Całe ciało · 6 ćwiczeń").put("streakOpen",3).put("streakBest",5).put("streakDays",new org.json.JSONArray("[true,true,false,false,true,true,true]"));WidgetState.publish(target(),sample,new org.json.JSONArray());
      AtomicReference<Throwable> failure=new AtomicReference<>();
      scenario.onActivity(activity->{try{
        for(float font:new float[]{1f,1.3f})for(int width:new int[]{280,360})for(boolean compact:new boolean[]{false,true}){
          android.content.res.Configuration config=new android.content.res.Configuration(activity.getResources().getConfiguration());config.fontScale=font;android.content.Context context=activity.createConfigurationContext(config);float density=context.getResources().getDisplayMetrics().density;
          android.widget.LinearLayout root=new android.widget.LinearLayout(context);root.setOrientation(1);root.setBackgroundColor(0xffeef1f5);int padding=(int)(16*density);root.setPadding(padding,padding,padding,padding);
          for(boolean water:new boolean[]{false,true}){android.view.View widget=FormaWidgetProvider.views(context,water,compact).apply(context,root);android.widget.LinearLayout.LayoutParams params=new android.widget.LinearLayout.LayoutParams(-1,(int)((compact?150:230)*density));params.bottomMargin=padding;root.addView(widget,params);}
          android.view.View streak=FormaWidgetProvider.streakViews(context).apply(context,root);android.widget.LinearLayout.LayoutParams streakParams=new android.widget.LinearLayout.LayoutParams(-1,(int)(150*density));root.addView(streak,streakParams);
          int pixels=(int)((width+32)*density);root.measure(android.view.View.MeasureSpec.makeMeasureSpec(pixels,android.view.View.MeasureSpec.EXACTLY),android.view.View.MeasureSpec.makeMeasureSpec((int)(750*density),android.view.View.MeasureSpec.EXACTLY));root.layout(0,0,root.getMeasuredWidth(),root.getMeasuredHeight());
          for(int i=0;i<2;i++){android.view.View widget=root.getChildAt(i);int action=i==0?R.id.widget_food:R.id.widget_plus;android.view.View button=widget.findViewById(action);assertTrue("Widget action fits its frame",button.getBottom()<=((android.view.View)button.getParent()).getHeight()+1);assertTrue("Touch target at least 44dp",button.getHeight()>=44*density-1);assertFalse(((android.widget.TextView)widget.findViewById(R.id.widget_value)).getText().toString().isEmpty());}
          assertEquals("Streak reflects real snapshot","3",((android.widget.TextView)streak.findViewById(R.id.widget_streak_value)).getText().toString());
          assertTrue("Streak action touch target",streak.findViewById(R.id.widget_streak_open).getHeight()>=44*density-1);
          assertNotNull("Calorie ring rendered",root.getChildAt(0).findViewById(R.id.widget_ring));
          if(font==1f&&width==360&&!compact){android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(root.getWidth(),root.getHeight(),android.graphics.Bitmap.Config.ARGB_8888);root.draw(new android.graphics.Canvas(bitmap));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(target().getExternalFilesDir(null),"FORMA-widzety-0.7.png"))){bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}bitmap.recycle();}
        }
      }catch(Throwable e){failure.set(e);}});if(failure.get()!=null)throw new AssertionError(failure.get());
    }finally{WidgetState.publish(target(),original,new org.json.JSONArray());FormaWidgetProvider.refresh(target());scenario.close();}
  }
  @Test public void w_homeLayoutProof() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    AtomicReference<Intent> originalLaunch=new AtomicReference<>();scenario.onActivity(a->originalLaunch.set(new Intent(a.getIntent())));
    try {
      until("document.querySelector('.bottom-nav')");click("Dzisiaj");
      assertEquals("Navigation reaches the viewport edges","true",js("const b=document.querySelector('.bottom-nav').getBoundingClientRect();return Math.abs(b.left)<1&&Math.abs(b.right-innerWidth)<1&&Math.abs(b.bottom-innerHeight)<2"));
      assertEquals("No horizontal overflow","true",js("return document.documentElement.scrollWidth<=innerWidth"));
      Thread.sleep(500);proofScreen("FORMA-home-0.7.png");js("document.querySelector('.daily-completion-card').scrollIntoView({block:'center'});return true");
      assertEquals("Completion uses same width as calculators","true",js("return Math.abs(document.querySelector('.daily-completion-card').clientWidth-document.querySelector('.home-calculators').clientWidth)<2"));Thread.sleep(300);proofScreen("FORMA-home-dol-0.7.png");
      scenario.onActivity(a->{android.view.View v=FormaWidgetProvider.views(a,true).apply(a,new android.widget.FrameLayout(a));v.findViewById(R.id.widget_root).performClick();});until("document.querySelector('.page-title h1')?.textContent==='Jedzenie'");
    }finally{scenario.onActivity(a->{a.setIntent(originalLaunch.get());a.finish();});scenario.close();}
  }
  private void openSavedWorkout() throws Exception {
    until("document.querySelector('.bottom-nav')");
    if(js("return Boolean(document.querySelector('.session-dock-open'))").equals("true")){js("document.querySelector('.session-dock-open').click();return true");}
    else {click("Trening");if(js("return document.body.innerText.includes('Otwórz trening')").equals("true"))click("Otwórz trening");}
    until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");
    if(js("return [...document.querySelectorAll('.session-controls button')].some(b=>b.innerText.trim()==='Wznów')").equals("true"))click("Wznów");
  }
  @Test public void x_remoteProductImagePolicy() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");
      js("window.photoProbeResult=null;window.photoProbe=new Image();window.photoProbe.onload=()=>window.photoProbeResult=window.photoProbe.naturalWidth>0;window.photoProbe.onerror=()=>window.photoProbeResult=false;window.photoProbe.src='https://images.openfoodfacts.org/images/products/590/053/100/0010/front_en.27.200.jpg';return true");
      until("window.photoProbeResult!==null");assertEquals("Production CSP allows the exact validated product photo host","true",js("return window.photoProbeResult"));
    }finally{scenario.close();}
  }
  private String js(String code) throws Exception {
    CountDownLatch latch=new CountDownLatch(1);
    AtomicReference<String> value=new AtomicReference<>("");
    scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript("(()=>{if(!document.getElementById('forma-qa-motion')){const s=document.createElement('style');s.id='forma-qa-motion';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.append(s);}"+code+"})()",r->{value.set(r);latch.countDown();}));
    assertTrue("WebView response",latch.await(10,TimeUnit.SECONDS));
    Object result=new JSONTokener(value.get()).nextValue();
    return String.valueOf(result);
  }
  private void until(String expression) throws Exception {
    long end=System.currentTimeMillis()+15000;
    while(System.currentTimeMillis()<end){if(js("return Boolean("+expression+")").equals("true"))return;Thread.sleep(150);}
    fail("UI condition: "+expression+"\n"+js("return document.body.innerText.slice(-6500)"));
  }
  private void click(String text) throws Exception {
    String q=JSONObject.quote(text);
    until("[...(document.querySelector('dialog[open]')||document).querySelectorAll('button,summary')].some(b=>!b.disabled&&b.getBoundingClientRect().width>0&&(b.getAttribute('aria-label')==="+q+"||b.innerText.trim()==="+q+"))");
    assertEquals("Button: "+text,"true",js("const root=document.querySelector('dialog[open]')||document;const b=[...root.querySelectorAll('button,summary')].find(b=>!b.disabled&&b.getBoundingClientRect().width>0&&(b.getAttribute('aria-label')==="+q+"||b.innerText.trim()==="+q+"));if(!b)return false;b.click();return true"));
    Thread.sleep(200);
  }
  private void fill(String label,String value) throws Exception {
    String q=JSONObject.quote(label),v=JSONObject.quote(value);
    assertEquals("Field: "+label,"true",js("const root=document.querySelector('dialog[open]')||document;let e=root.querySelector('[aria-label='+CSS.escape("+q+")+']');if(!e){const l=[...root.querySelectorAll('label')].find(x=>x.querySelector('span')?.textContent.trim()==="+q+");e=l?.querySelector('input,select,textarea');}if(!e||e.disabled)return false;Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,"+v+");e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true"));
    Thread.sleep(150);
  }
  @Test public void a_realisticDayFoodWorkoutPersistenceAndSecurity() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('button')");
      if(js("return document.body.innerText.includes('Zaczynamy')").equals("true")){
        click("Zaczynamy");fill("Jak się do Ciebie zwracać?","Tester");fill("Wiek · lata","30");fill("Wzrost · cm","180");click("Dalej");click("Dalej");fill("Dzienny cel · kcal","2400");fill("Woda · ml","2500");click("Przejdź do aplikacji");
      }
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Jedzenie");
      for(int i=0;i<5;i++)click("Dodaj 250 ml wody");
      until("document.body.innerText.includes('1 250')||document.body.innerText.includes('1250')||document.body.innerText.includes('1 250')");
      click("Jedzenie");
      click("Dodaj posiłek");
      fill("Szukaj produktu", "SEREK WIEJSKI");
      until("[...document.querySelectorAll('.product-row')].some(x=>x.innerText.includes('SEREK WIEJSKI'))");
      js("document.querySelector('.product-row .entry-main').click();return true");
      until("document.body.innerText.includes('Dodaj porcję')");
      fill("Porcja · g", "150");
      String firstPreview=js("return document.querySelector('.portion-preview strong').innerText");
      assertTrue("Portion preview",firstPreview.contains("kcal"));
      click("Dodaj do dziennika");
      until("document.querySelector('.food-entry')");
      assertTrue(js("return document.querySelector('.food-entry').innerText").contains("150"));
      // Edit one entry; it must not be duplicated.
      js("document.querySelector('.food-entry .entry-main').click();return true");
      until("document.querySelector('dialog[open]')");
      fill("Porcja · g", "100");
      click("Zapisz zmianę");
      until("!document.querySelector('dialog[open]')");
      assertEquals("One edited entry", "1",js("return document.querySelectorAll('.food-entry').length"));
      click("Trening");
      startFirstPlan();
      until("document.querySelector('input[aria-label=\"Ciężar serii 1\"]')");
      click("Ustawienia serii i zapas powtórzeń");fill("Ciężar serii 1","40,5");fill("Powtórzenia serii 1","10");fill("RIR serii 1","2");
      click("Zapisz serię 1");
      until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
      // Activity recreation destroys the WebView and proves IndexedDB persistence.
      scenario.recreate();
      openSavedWorkout();
      until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");
      assertEquals("40.5",js("return document.querySelector('[aria-label=\"Ciężar serii 1\"]').value"));
      click("Pauza");
      until("document.querySelector('input[aria-label=\"Powtórzenia serii 2\"]').disabled");
      click("Wznów");
      click("Zakończ");
      until("document.body.innerText.includes('Zakończyć trening?')");
      click("Zakończ i zapisz");
      until("(document.querySelector('.page-title h1')?.textContent==='Trening'||document.body.innerText.includes('Twój trening.'))");
      click("Historia");
      assertTrue(js("return document.querySelector('.history-list').innerText").contains("1 serii"));
      click("Jedzenie");
      until("document.querySelectorAll('.food-entry').length===1");
      click("Dzisiaj");
      assertEquals("Water belongs to food diary","0",js("return document.querySelectorAll('.water-panel').length"));click("Jedzenie");assertTrue(js("return document.body.innerText").contains("250"));
    } finally {scenario.close();}
  }
  @Test public void d_importedTextAndLinkSecurity() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");click("Jedzenie");click("Dodaj posiłek");click("Własny produkt");
      String payload="<img src=x onerror=alert(1)>";
      fill("Nazwa produktu",payload);fill("Energia · kcal","100");click("Zapisz produkt");
      until("document.body.innerText.includes('Dodaj porcję')");
      assertEquals("Payload rendered as plain text",payload,js("return document.querySelector('.selected-product').textContent"));
      assertEquals("No injected HTML","0",js("return document.querySelectorAll('img[src=x]').length"));
      click("Zamknij");click("Profil i ustawienia");click("Wygląd i trening");fill("Twoja playlista Spotify · opcjonalnie","https://open.spotify.com.evil.test/playlist/attack");click("Zapisz playlistę");
      until("document.querySelector(':is([role=status],[role=alert])')?.innerText.includes('Wklej link')");
      click("Zamknij");
    } finally {scenario.close();}
  }
  @Test public void h_draftsPinnedNotesWarmupsAndCopy() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");click("Trening");
      startFirstPlan();until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");
      click("Dodaj ustawienia ćwiczenia");fill("Notatka do ćwiczenia w tym miejscu","Siedzisko 4; uchwyt 6");click("Zapisz ustawienia");
      until("document.querySelector('.pinned-note')?.textContent.includes('Siedzisko 4')");
      fill("Ciężar serii 1","42,5");fill("Powtórzenia serii 1","10");
      click("Jedzenie");click("Trening");if(js("return document.body.innerText.includes('Otwórz trening')").equals("true"))click("Otwórz trening");until("document.querySelector('[aria-label=\"Ciężar serii 1\"]').value==='42,5'");
      scenario.recreate();openSavedWorkout();
      until("document.querySelector('[aria-label=\"Powtórzenia serii 1\"]').value==='10'");
      assertEquals("Draft not counted as completed","0",js("return document.querySelectorAll('.set-row-wrap.done').length"));
      assertTrue(js("return document.querySelector('.pinned-note').textContent").contains("Siedzisko 4"));
      click("Ustawienia serii i zapas powtórzeń");fill("Typ serii 1","warmup");click("Zapisz serię 1");until("document.querySelector('.rest-timer strong')");
      String warmupTimer=js("return document.querySelector('.rest-timer strong').textContent");
      assertTrue("Separate warmup timer: "+warmupTimer+"; kind="+js("return document.querySelector('[aria-label=\"Typ serii 1\"]').value"),warmupTimer.matches("1:00|0:[45][0-9]"));
      click("Pomiń przerwę");fill("Ciężar serii 2","55");fill("Powtórzenia serii 2","12");click("Zapisz serię 2");
      until("document.querySelector('[aria-label=\"Cofnij serię 2\"]')");click("Powiel serię 2 do pustych serii");
      until("document.querySelector('[aria-label=\"Ciężar serii 3\"]').value==='55'");
      assertEquals("Copy is not confirmation","false",js("return Boolean(document.querySelector('[aria-label=\"Cofnij serię 3\"]'))"));
      click("Pauza");until("[...document.querySelectorAll('.session-controls button')].some(b=>b.innerText.trim()==='Wznów')");assertEquals("Paused fields and actions locked","true",js("return [...document.querySelectorAll('.set-row input,.set-row select,.set-row button,.set-extra button')].every(e=>e.disabled)"));
      click("Wznów");click("Pomiń serię 3");click("Cofnij serię 3");
      assertEquals("Undo keeps draft","55",js("return document.querySelector('[aria-label=\"Ciężar serii 3\"]').value"));
      click("Zakończ");click("Zakończ i zapisz");until("(document.querySelector('.page-title h1')?.textContent==='Trening'||document.body.innerText.includes('Twój trening.'))");
    }finally{scenario.close();}
  }
  @Test public void i_recipeIngredientsValidationUndoAndHistory() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try{
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");click("Jedzenie");
      String baseline=js("return document.querySelector('.nutrition-card').innerText");int count=Integer.parseInt(js("return document.querySelectorAll('.food-entry').length"));
      click("Moje przepisy");click("Nowy przepis");click("Zapisz przepis");
      until("document.querySelector('dialog[open] :is([role=status],[role=alert])')?.textContent.includes('Podaj nazwę')");
      assertEquals("Validation is visible inside dialog","true",js("return Boolean(document.querySelector('dialog[open] :is([role=status],[role=alert])'))"));
      fill("Nazwa dania","Zestaw testowy");fill("Szukaj składnika przepisu","Płatki owsiane");fill("Produkt","food-0");fill("Ilość · g lub ml produktu","60");click("Dodaj");
      fill("Szukaj składnika przepisu","Mleko 2%");fill("Produkt","food-10");fill("Ilość · g lub ml produktu","200");click("Dodaj");fill("Masa całej potrawy po przygotowaniu · g","260");click("Zapisz przepis");
      until("!document.querySelector('dialog[open]')");click("Dodaj składniki osobno");fill("Płatki owsiane · g","-1");click("Dodaj składniki do dziennika");
      until("document.querySelector('dialog[open] :is([role=status],[role=alert])')?.textContent.includes('Sprawdź ilości')");
      fill("Płatki owsiane · g","50");fill("Mleko 2% · ml","150");fill("Status","planned");click("Zaplanuj składniki");
      until("!document.querySelector('dialog[open]')");click("Dziennik");until("document.querySelectorAll('.food-entry').length==="+(count+2));
      assertEquals("Planned food does not increase consumed calories",baseline,js("return document.querySelector('.nutrition-card').innerText"));click("Cofnij");
      until("document.querySelectorAll('.food-entry').length==="+count);
      click("Moje przepisy");click("Dodaj składniki osobno");fill("Płatki owsiane · g","50");fill("Mleko 2% · ml","150");click("Dodaj składniki do dziennika");
      until("!document.querySelector('dialog[open]')");click("Dziennik");until("document.querySelectorAll('.food-entry').length==="+(count+2));
      assertEquals("No double counted cooked dish","2",js("return [...document.querySelectorAll('.food-entry')].filter(e=>e.innerText.includes('Zestaw testowy')).length"));
      click("Moje przepisy");js("[...document.querySelectorAll('.recipe-row .entry-main')].find(b=>b.innerText.includes('Zestaw testowy')).click();return true");
      until("document.body.innerText.includes('Edytuj przepis')");click("Usuń przepis");click("Usuń przepis");until("!document.querySelector('dialog[open]')");
      click("Dziennik");assertEquals("Deleting recipe preserves historical entries",String.valueOf(count+2),js("return document.querySelectorAll('.food-entry').length"));
    }finally{scenario.close();}
  }
  @Test public void j_streaksCatalogAndFoodShortcuts() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.streak-grid')");
      until("document.querySelector('.streak-card')?.getAttribute('aria-label').includes('dzisiaj zaliczone')");
      assertEquals("One actual open day", "1", js("return document.querySelector('.streak-card > strong').childNodes[0].textContent"));
      String labels=js("return [...document.querySelectorAll('.streak-card')].map(b=>b.getAttribute('aria-label')).join('|')");
      scenario.recreate();until("document.querySelector('.streak-card')?.getAttribute('aria-label').includes('dzisiaj zaliczone')");
      assertEquals("Reopening cannot inflate streak",labels,js("return [...document.querySelectorAll('.streak-card')].map(b=>b.getAttribute('aria-label')).join('|')"));
      js("document.querySelector('.streak-card').click();return true");until("document.body.innerText.includes('Seria · Powroty')");
      assertEquals("30 calendar dates","30",js("return document.querySelectorAll('.streak-calendar [role=listitem]').length"));
      assertEquals("Only today is an observed open day","1",js("return document.querySelectorAll('.streak-calendar .done').length"));click("Zamknij");
      click("Jedzenie");click("Dodaj posiłek");
      assertTrue("Extended real catalog",Integer.parseInt(js("return document.querySelector('.sheet .eyebrow').textContent.match(/\\d+/)[0]"))>=10000);
      click("Ostatnie");fill("Szukaj produktu","platki");until("document.querySelector('.product-row')");
      assertTrue("Accent independent recent food search",js("return document.querySelector('.product-row').textContent").contains("Płatki owsiane"));
      js("document.querySelector('.product-row .entry-main').click();return true");until("document.body.innerText.includes('Ostatnia porcja')");
      click("Ostatnia porcja · 50 g");assertEquals("Last actual portion reused","50",js("return document.querySelector('dialog input[inputmode=decimal]').value"));click("Zamknij");
      click("Dodaj posiłek");click("Najczęstsze");assertTrue("Frequency list available",Integer.parseInt(js("return document.querySelectorAll('.product-row').length"))>0);
      click("Wszystkie");fill("Szukaj produktu","");until("document.querySelectorAll('.product-row').length===60");
      js("[...document.querySelectorAll('dialog button')].find(b=>b.innerText.startsWith('Pokaż kolejne')).click();return true");until("document.querySelectorAll('.product-row').length===120");click("Zamknij");
      click("Dzisiaj");assertEquals("Browsing cannot change streaks",labels,js("return [...document.querySelectorAll('.streak-card')].map(b=>b.getAttribute('aria-label')).join('|')"));
    } finally {scenario.close();}
  }
  private android.content.Context target(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
  private android.app.Notification liveNotification() throws Exception {
    android.app.NotificationManager nm=(android.app.NotificationManager)target().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
    for(android.service.notification.StatusBarNotification n:nm.getActiveNotifications())if(n.getId()==WorkoutNotification.ID)return n.getNotification();return null;
  }
  private void waitNative(java.util.function.BooleanSupplier condition) throws Exception {long end=System.currentTimeMillis()+10000;while(System.currentTimeMillis()<end){if(condition.getAsBoolean())return;Thread.sleep(100);}assertTrue("Native Android state",condition.getAsBoolean());}
  @Test public void k_waterCorrectionsAndActualWidgetControls() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    AtomicReference<Intent> originalLaunch=new AtomicReference<>();scenario.onActivity(a->originalLaunch.set(new Intent(a.getIntent())));
    try {
      until("document.querySelector('.bottom-nav')");click("Jedzenie");
      int original=Integer.parseInt(js("return document.querySelector('.water-track').getAttribute('aria-valuenow')"));
      click("Dodaj 250 ml wody");until("document.querySelector('.water-track').getAttribute('aria-valuenow')==='"+(original+250)+"'");click("Cofnij");until("document.querySelector('.water-track').getAttribute('aria-valuenow')==='"+original+"'");
      click("Zmień ilość");fill("Woda tego dnia · ml","0");click("Zapisz ilość");until("document.querySelector('[aria-label=\"Odejmij 250 ml wody\"]').disabled");click("Cofnij");
      waitNative(()->WidgetState.snapshot(target()).optBoolean("configured")&&WidgetState.water(target())==original);
      scenario.onActivity(a->{android.view.View view=FormaWidgetProvider.views(a,true).apply(a,new android.widget.FrameLayout(a));view.findViewById(R.id.widget_plus).performClick();});Thread.sleep(200);
      scenario.onActivity(a->{android.view.View view=FormaWidgetProvider.views(a,true).apply(a,new android.widget.FrameLayout(a));view.findViewById(R.id.widget_plus).performClick();});Thread.sleep(200);
      scenario.onActivity(a->{android.view.View view=FormaWidgetProvider.views(a,true).apply(a,new android.widget.FrameLayout(a));view.findViewById(R.id.widget_minus).performClick();});Thread.sleep(200);
      assertEquals(original+250,WidgetState.water(target()));
      scenario.recreate();until("document.querySelector('.bottom-nav')");click("Jedzenie");until("document.querySelector('.water-track').getAttribute('aria-valuenow')==='"+(original+250)+"'");waitNative(()->WidgetState.pending(target()).length()==0);
      scenario.recreate();until("document.querySelector('.bottom-nav')");click("Jedzenie");until("document.querySelector('.water-track').getAttribute('aria-valuenow')==='"+(original+250)+"'");click("Odejmij 250 ml wody");
      assertFalse(target().getPackageManager().getReceiverInfo(new android.content.ComponentName(target(),FormaWidgetProvider.class),0).exported);
      assertFalse(target().getPackageManager().getReceiverInfo(new android.content.ComponentName(target(),FormaWaterWidgetProvider.class),0).exported);
      assertFalse(target().getPackageManager().getReceiverInfo(new android.content.ComponentName(target(),FormaStreakWidgetProvider.class),0).exported);
      scenario.onActivity(a->{android.view.View view=FormaWidgetProvider.views(a,false).apply(a,new android.widget.FrameLayout(a));view.findViewById(R.id.widget_food).performClick();});until("document.querySelector('dialog [aria-label=\"Szukaj produktu\"]')");click("Zamknij");
    }finally{scenario.onActivity(a->{a.setIntent(originalLaunch.get());a.finish();});scenario.close();}
  }
  @Test public void m_backgroundWorkoutNotificationControls() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");click("Trening");startFirstPlan();until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");
      waitNative(()->{try{return liveNotification()!=null;}catch(Exception e){return false;}});
      assertTrue("Ongoing notification",(liveNotification().flags&android.app.Notification.FLAG_ONGOING_EVENT)!=0);
      assertTrue("System chronometer",liveNotification().extras.getBoolean(android.app.Notification.EXTRA_SHOW_CHRONOMETER));
      assertTrue("Live Update request",liveNotification().extras.getBoolean("android.requestPromotedOngoing"));
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
      liveNotification().actions[0].actionIntent.send();waitNative(()->WorkoutNotification.snapshot(target()).optString("status").equals("paused"));
      assertFalse("Paused clock is not running",liveNotification().extras.getBoolean(android.app.Notification.EXTRA_SHOW_CHRONOMETER));
      liveNotification().actions[0].actionIntent.send();waitNative(()->WorkoutNotification.snapshot(target()).optString("status").equals("active"));
      liveNotification().actions[1].actionIntent.send();waitNative(()->WorkoutNotification.snapshot(target()).optLong("restEndsAt")>System.currentTimeMillis());
      long deadline=WorkoutNotification.snapshot(target()).optLong("restEndsAt");liveNotification().actions[2].actionIntent.send();waitNative(()->WorkoutNotification.snapshot(target()).optLong("restEndsAt")==deadline+30000);
      liveNotification().actions[1].actionIntent.send();waitNative(()->WorkoutNotification.snapshot(target()).optLong("restEndsAt")==0);
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);waitNative(()->WorkoutNotification.pending(target()).length()==0);until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Pauza')");
      scenario.recreate();openSavedWorkout();until("document.querySelector('[aria-label=\"Ciężar serii 1\"]')");assertEquals("Running notification survives recreation","false",js("return document.querySelector('[aria-label=\"Ciężar serii 1\"]').disabled"));
      click("Zakończ");click("Zakończ i zapisz");waitNative(()->{try{return liveNotification()==null;}catch(Exception e){return false;}});
      assertFalse(target().getPackageManager().getReceiverInfo(new android.content.ComponentName(target(),WorkoutActionReceiver.class),0).exported);
    }finally{scenario.close();}
  }
  @Test public void n_trainingRowsAndBundledPhotos() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");click("Trening");
      assertEquals("Every plan cover fills its frame","true",js("return [...document.querySelectorAll('.plan-cover')].every(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg')?.getBoundingClientRect();return b&&Math.abs(a.top-b.top)<1&&Math.abs(a.height-b.height)<1&&Math.abs(a.width-b.width)<1;})"));
      js("document.querySelector('.plan-open').click();return true");until("document.querySelector('.plan-exercise-preview')");
      int rows=Integer.parseInt(js("return document.querySelectorAll('.plan-exercise-preview .list-row').length"));assertTrue(rows>0);
      for(int i=0;i<rows;i++){
        js("document.querySelectorAll('.plan-exercise-preview .list-row')["+i+"].scrollIntoView({block:'center'});return true");
        until("document.querySelectorAll('.plan-exercise-preview img')["+i+"].naturalWidth>0");
      }
      assertEquals("Numbers keep a compact column and every row fits the phone","true",js("return [...document.querySelectorAll('.plan-exercise-preview .list-row')].every(r=>r.querySelector('.exercise-order').getBoundingClientRect().width<=32&&r.scrollWidth<=r.clientWidth)"));
      click("Zamknij");click("Ćwiczenia");until("document.querySelectorAll('.exercise-list .list-row').length===300");
      for(int i=0;i<300;i++){
        js("document.querySelectorAll('.exercise-list .list-row')["+i+"].scrollIntoView({block:'center'});return true");
        until("document.querySelectorAll('.exercise-list img')["+i+"].naturalWidth>0");
      }
      assertEquals("All exercises fit the phone","true",js("return [...document.querySelectorAll('.exercise-list .list-row')].every(r=>r.scrollWidth<=r.clientWidth)"));
      js("document.querySelector('.exercise-list .list-row').scrollIntoView({block:'center'});document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('.exercise-frames img')?.complete&&document.querySelector('.exercise-frames img').naturalWidth>0");
      assertEquals("Technique photo keeps its natural proportions","true",js("const e=document.querySelector('.exercise-frames img');return Math.abs(e.clientHeight-e.clientWidth*e.naturalHeight/e.naturalWidth)<1.5"));js("document.querySelectorAll('.frame-controls button')[1].click();return true");until("document.querySelector('.exercise-frames img').complete&&document.querySelector('.exercise-frames img').getAttribute('src').endsWith('/1.jpg')");click("Zamknij");
    }finally{scenario.close();}
  }
  @Test public void o_homeWeekAndActionCards() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.week-card')");assertEquals("Seven calendar days","7",js("return document.querySelectorAll('.week-card .week-strip button').length"));
      String originalDate=js("return document.querySelector('[aria-label=\"Wybierz dzień\"]').value");
      js("document.querySelector('.week-strip button').click();return true");until("document.querySelector('.week-strip button[aria-current=date]')===document.querySelector('.week-strip button')");fill("Wybierz dzień",originalDate);
      js("document.querySelector('.weight-action').click();return true");until("document.querySelector('dialog[open]')");click("Zamknij");click("Dodaj aktywność");until("document.querySelector('dialog[open]')");click("Zamknij");
      until("document.querySelector('[aria-label=\"Wybierz dzień\"]').value==="+JSONObject.quote(originalDate));
      if(js("return document.querySelector('.daily-completion-card').disabled").equals("true")){assertEquals("An empty diary cannot be marked complete","false",js("return document.querySelector('.daily-completion-card').getAttribute('aria-checked')"));}
      else {boolean complete=js("return document.querySelector('.daily-completion-card').classList.contains('is-complete')").equals("true");click("Wszystkie posiłki zapisane");until("document.querySelector('.daily-completion-card').classList.contains('is-complete')==="+(!complete));click("Wszystkie posiłki zapisane");until("document.querySelector('.daily-completion-card').classList.contains('is-complete')==="+complete);}
      assertEquals("Home fits the phone","true",js("return document.documentElement.scrollWidth<=innerWidth"));
    }finally{scenario.close();}
  }
  @Test public void p_createProgramWithWeeklySetsAndTimedExercise() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");click("Trening");click("Utwórz plan");fill("Nazwa treningu","Próba programu");fill("Szacowany czas · min","0");
      click("Program, zasady i cardio");fill("Nazwa programu · opcjonalnie","Obwód testowy");fill("Zasady i uwagi","Dwa ćwiczenia można łączyć w grupę A.");fill("Cardio po treningu","20 min spokojnego marszu.");click("Dodaj ćwiczenie");fill("Szukaj ćwiczenia","Spacer farmera");
      js("document.querySelector('.exercise-list .list-row').click();return true");until("document.querySelector('.plan-editor-item')");click("Obwód, tempo i progresja tygodniowa");fill("Grupa obwodu","A");fill("Tempo ruchu","X");fill("Przerwa między ćwiczeniami obwodu · s","45");fill("Jednostka wyniku","seconds");fill("Własny cel zamiast zakresu · opcjonalnie","30–45 s");fill("Serie w tygodniu 3","4");click("Zapisz plan");until("!document.querySelector('dialog[open]')");
      js("[...document.querySelectorAll('.plan-open')].find(b=>b.innerText.includes('Próba programu')).click();return true");until("document.querySelector('.plan-exercise-preview')");click("T3");until("document.querySelector('.plan-exercise-preview').innerText.includes('4 serie')");
      click("Rozpocznij trening");until("document.querySelector('[aria-label=\"Sekundy serii 1\"]')");assertEquals("Week three materializes four sets","4",js("return document.querySelectorAll('.set-row-wrap').length"));fill("Ciężar serii 1","20");fill("Sekundy serii 1","40");click("Zapisz serię 1");until("document.querySelector('[aria-label=\"Cofnij serię 1\"]')");click("Zakończ");click("Zakończ i zapisz");until("document.querySelector('.plan-open')");
      js("[...document.querySelectorAll('.plan-open')].find(b=>b.innerText.includes('Próba programu')).click();return true");until("document.querySelector('dialog[open]')");click("Edytuj plan");click("Usuń plan");click("Usuń plan");until("!document.querySelector('dialog[open]')");
    }finally{scenario.close();}
  }
  @Test public void t_homeWeekFoodHistory() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.home-calendar')");
      String today=js("return document.querySelector('[aria-label=\"Wybierz dzień\"]').value");
      String todayKcal=js("return document.querySelector('.nutrition-card .kcal-number').textContent");
      click("Poprzedni tydzień");String historyDate=js("return document.querySelector('[aria-label=\"Wybierz dzień\"]').value");assertNotEquals(today,historyDate);
      click("Posiłki dnia");click("Dodaj do: Śniadanie");until("document.querySelector('dialog[open]')");
      click("Szybkie kcal");fill("Nazwa","Próba poprzedniego tygodnia");fill("Energia · kcal","150");click("Zapisz kalorie");until("document.querySelector('.home-day-meals').innerText.includes('Próba poprzedniego tygodnia')");
      click("Dziś");until("document.querySelector('[aria-label=\"Wybierz dzień\"]').value==="+JSONObject.quote(today));assertEquals(todayKcal,js("return document.querySelector('.nutrition-card .kcal-number').textContent"));assertEquals("No historical food in today's preview","false",js("return document.querySelector('.home-day-meals').innerText.includes('Próba poprzedniego tygodnia')"));
      click("Poprzedni tydzień");until("document.querySelector('.home-day-meals').innerText.includes('Próba poprzedniego tygodnia')");click("Otwórz dziennik dnia");until("document.querySelector('.food-entry')");assertEquals("Food tab uses the same historical day",historyDate,js("return document.querySelector('[aria-label=\"Wybierz dzień\"]').value"));assertTrue(js("return document.body.innerText").contains("Próba poprzedniego tygodnia"));
      click("Dzisiaj");click("Dziś");click("Następny tydzień");click("Posiłki dnia");click("Dodaj do: Obiad");until("document.querySelector('dialog[open]')");click("Szybkie kcal");assertEquals("Future logging starts as planned","planned",js("return [...document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.trim()==='Status').querySelector('select').value"));click("Zamknij");click("Dziś");
      assertEquals("Stable nav label weights","1",js("return new Set([...document.querySelectorAll('.bottom-nav button')].map(b=>getComputedStyle(b).fontWeight)).size"));assertEquals("No fake thickening on active nav icon","none",js("return getComputedStyle(document.querySelector('.bottom-nav .active svg')).filter"));
    }finally{scenario.close();}
  }
  @Test public void s_foodScannerAndIdentity() throws Exception {
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");
      String qr="https://id.gs1.org/01/05900531000010";
      for(String name:new String[]{"food-code-qr.png","food-code-ean.png"}){
        java.io.File file=new java.io.File(target().getCacheDir(),name);
        try(java.io.InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(name);java.io.FileOutputStream out=new java.io.FileOutputStream(file)){input.transferTo(out);}
        String uri=android.net.Uri.fromFile(file).toString();
        js("window.scannedFood=null;window.Capacitor.nativePromise('BarcodeScanner','readBarcodesFromImage',{path:"+JSONObject.quote(uri)+",formats:['EAN_13','EAN_8','UPC_A','QR_CODE']}).then(r=>window.scannedFood=r).catch(e=>window.scannedFood={error:String(e)});return true");
        until("window.scannedFood!==null");assertEquals("Native ML Kit decoded actual image pixels",name.contains("qr")?qr:"5900531000010",js("return window.scannedFood.barcodes?.[0]?.rawValue||JSON.stringify(window.scannedFood)"));file.delete();
      }
      click("Jedzenie");click("Dodaj posiłek");until("document.querySelector('[aria-label=\"Szukaj produktu\"]')");
      assertEquals("Visible scanner, not in a closed disclosure","true",js("return [...document.querySelectorAll('dialog button')].some(b=>b.innerText.includes('Skanuj EAN / QR')&&b.getBoundingClientRect().height>=44)"));
      fill("Szukaj produktu",qr);click("Szukaj online");until("document.querySelector('.food-lookup .list-row')");
      assertEquals("QR resolves exact cached code","5900531000010",js("return document.querySelector('[aria-label=\"Szukaj produktu\"]').value"));
      until("document.querySelector('.food-lookup img')?.naturalWidth>0");
      js("document.querySelector('.food-lookup .list-row').click();return true");until("document.querySelector('.selected-product')");
      assertEquals("Actual product image in portion preview","true",js("return document.querySelector('.selected-food-heading img').src.endsWith('/5900531000010.jpg')"));click("Zamknij");
      click("Dodaj posiłek");fill("Szukaj produktu","usda-172187");fill("Szukaj produktu","jajecznica");until("document.querySelector('.product-row')");
      assertTrue("Named dish is ranked before egg-white ingredient mentions",js("return document.querySelector('.product-row strong').textContent").startsWith("Jajecznica"));click("Zamknij");
    }finally{scenario.close();}
  }
  @Test public void r_downloadUpdateFromInstalledVersion() throws Exception {
    Intents.init();intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));scenario=ActivityScenario.launch(MainActivity.class);
    try {
      String version=InstrumentationRegistry.getArguments().getString("releaseVersion"),sha=InstrumentationRegistry.getArguments().getString("releaseSha");int code=Integer.parseInt(InstrumentationRegistry.getArguments().getString("releaseCode"));
      until("document.querySelector('.bottom-nav')");click("Profil i ustawienia");click("Aktualizacje aplikacji");until("document.body.innerText.includes("+JSONObject.quote("Dostępna wersja "+version)+")");click("Pobierz aktualizację");long end=System.currentTimeMillis()+60000;while(System.currentTimeMillis()<end&&!js("return document.body.innerText.includes('gotowa do instalacji')").equals("true"))Thread.sleep(200);until("document.body.innerText.includes('gotowa do instalacji')");
      AtomicReference<Object> instance=new AtomicReference<>();scenario.onActivity(a->instance.set(a.getBridge().getPlugin("FormaUpdater").getInstance()));java.lang.reflect.Method validate=FormaUpdaterPlugin.class.getDeclaredMethod("validate",java.io.File.class);validate.setAccessible(true);java.io.File[] files=new java.io.File(target().getCacheDir(),"updates").listFiles();assertNotNull(files);assertEquals(1,files.length);org.json.JSONObject info=(org.json.JSONObject)validate.invoke(instance.get(),files[0]);assertEquals(code,info.getInt("versionCode"));assertEquals(sha,info.getString("sha256"));
      click("Zainstaluj aktualizację");Thread.sleep(300);intended(allOf(hasAction(Intent.ACTION_VIEW),hasType("application/vnd.android.package-archive")));click("Zamknij");
    }finally{scenario.close();Intents.release();}
  }
  private void rejected(java.lang.reflect.Method method,Object instance,Object...args) throws Exception {
    try{method.invoke(instance,args);fail("Unsafe update accepted");}catch(java.lang.reflect.InvocationTargetException e){assertTrue("Descriptive updater rejection",e.getCause() instanceof java.io.IOException);}
  }
  @Test public void q_publicUpdateDownloadAndNativeValidation() throws Exception {
    Intents.init();intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("document.querySelector('.bottom-nav')");
      String releaseVersion=InstrumentationRegistry.getArguments().getString("releaseVersion","0.5.1");int releaseCode=Integer.parseInt(InstrumentationRegistry.getArguments().getString("releaseCode","6"));
      java.io.File fixtures=new java.io.File(target().getCacheDir(),"update-fixtures");assertTrue(fixtures.isDirectory()||fixtures.mkdirs());
      for(String name:new String[]{"release.apk","old.apk","wrong-signature.apk","wrong-package.apk"}){
        try(java.io.InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("update-fixtures/"+name);java.io.OutputStream out=new java.io.FileOutputStream(new java.io.File(fixtures,name))){byte[] buffer=new byte[65536];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);}
      }
      AtomicReference<Object> instance=new AtomicReference<>();scenario.onActivity(a->instance.set(a.getBridge().getPlugin("FormaUpdater").getInstance()));
      assertTrue("Update fixture: "+fixtures.getAbsolutePath()+" exists="+fixtures.exists()+" app="+target().getPackageName(),new java.io.File(fixtures,"release.apk").length()>0);
      Object updater=instance.get();java.lang.reflect.Method validate=FormaUpdaterPlugin.class.getDeclaredMethod("validate",java.io.File.class);validate.setAccessible(true);
      org.json.JSONObject good=(org.json.JSONObject)validate.invoke(updater,new java.io.File(fixtures,"release.apk"));assertEquals(releaseCode,good.getInt("versionCode"));
      rejected(validate,updater,new java.io.File(fixtures,"old.apk"));rejected(validate,updater,new java.io.File(fixtures,"wrong-signature.apk"));rejected(validate,updater,new java.io.File(fixtures,"wrong-package.apk"));
      java.io.File bad=new java.io.File(target().getCacheDir(),"broken.apk");try(java.io.FileOutputStream out=new java.io.FileOutputStream(bad)){out.write(new byte[]{1,2,3});}rejected(validate,updater,bad);bad.delete();
      java.lang.reflect.Method connection=FormaUpdaterPlugin.class.getDeclaredMethod("connect",String.class);connection.setAccessible(true);
      for(String address:new String[]{"http://forma-mobi-2026-4e7c1a.web.app/releases/latest.json","https://forma-mobi-2026-4e7c1a.web.app.evil.test/releases/latest.json","https://forma-mobi-2026-4e7c1a.web.app:443/releases/latest.json","https://forma-mobi-2026-4e7c1a.web.app/releases/latest.json?redirect=1","https://forma-mobi-2026-4e7c1a.web.app/private.apk"})rejected(connection,updater,address);
      java.lang.reflect.Method ready=FormaUpdaterPlugin.class.getDeclaredMethod("ready",com.getcapacitor.PluginCall.class,java.io.File.class,org.json.JSONObject.class);ready.setAccessible(true);
      org.json.JSONObject mismatch=new org.json.JSONObject(good.toString());mismatch.put("sha256","0000000000000000000000000000000000000000000000000000000000000000");rejected(ready,updater,null,new java.io.File(fixtures,"release.apk"),mismatch);
      click("Profil i ustawienia");click("Aktualizacje aplikacji");until("document.body.innerText.includes("+JSONObject.quote("Dostępna wersja "+releaseVersion)+")");click("Pobierz aktualizację");
      long end=System.currentTimeMillis()+60000;while(System.currentTimeMillis()<end&&!js("return document.body.innerText.includes('gotowa do instalacji')").equals("true"))Thread.sleep(200);
      until("document.body.innerText.includes('gotowa do instalacji')");
      java.io.File[] downloaded=new java.io.File(target().getCacheDir(),"updates").listFiles();assertNotNull(downloaded);assertEquals("One bounded update cache",1,downloaded.length);
      org.json.JSONObject downloadedInfo=(org.json.JSONObject)validate.invoke(updater,downloaded[0]);assertEquals("Downloaded bytes match signed release",good.getString("sha256"),downloadedInfo.getString("sha256"));
      click("Zainstaluj aktualizację");Thread.sleep(300);intended(allOf(hasAction(Intent.ACTION_VIEW),hasType("application/vnd.android.package-archive")));
      click("Zamknij");
    }finally{scenario.close();Intents.release();}
  }
  @Test public void g_liveCloudBackupAndRestore() throws Exception {
    String email=InstrumentationRegistry.getArguments().getString("cloudEmail");
    String password=InstrumentationRegistry.getArguments().getString("cloudPassword");
    assertNotNull("Temporary cloud fixture required",email);
    assertNotNull("Temporary cloud fixture required",password);
    scenario=ActivityScenario.launch(MainActivity.class);
    try {
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Jedzenie");String water=js("return document.querySelector('.water-track').getAttribute('aria-valuenow')");
      click("Profil i ustawienia");
      until("document.querySelector('.cloud-account input[type=email]')");
      fill("E-mail konta",email);fill("Hasło",password);click("Zaloguj się");
      until("document.body.innerText.includes('Utwórz kopię w Firebase')");
      click("Utwórz kopię w Firebase");
      until("document.querySelector('.cloud-account :is([role=status],[role=alert])')?.textContent.includes('Kopia została zapisana')");
      click("Zamknij");click("Dodaj 250 ml wody");
      assertNotEquals("Local change before restore",water,js("return document.querySelector('.water-track').getAttribute('aria-valuenow')"));
      click("Profil i ustawienia");until("document.body.innerText.includes('Pokaż kopie tego konta')");
      click("Pokaż kopie tego konta");
      until("document.querySelector('.cloud-account .list-row')");
      js("document.querySelector('.cloud-account .list-row').click();return true");
      until("document.body.innerText.includes('Przywrócić kopię z Firebase?')");
      click("Przywróć tę kopię");
      until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      assertEquals("Cloud restore preserves original day",water,js("return document.querySelector('.water-track').getAttribute('aria-valuenow')"));
      scenario.recreate();until("(document.body.innerText.includes('Bilans kalorii')||document.body.innerText.includes('Twój bilans'))");
      click("Profil i ustawienia");until("document.body.innerText.includes('Wyloguj się')");
      click("Wyloguj się");until("document.querySelector('.cloud-account input[type=email]')");
      click("Zamknij");
    } finally {scenario.close();}
  }
}
