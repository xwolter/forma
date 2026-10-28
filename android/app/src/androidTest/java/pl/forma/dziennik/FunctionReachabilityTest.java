package pl.forma.dziennik;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import android.webkit.WebView;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FunctionReachabilityTest {
  @Test public void hostingCallableIsReachableFromAndroidWebView() throws Exception {
    try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
      AtomicReference<String> value = new AtomicReference<>("pending");
      scenario.onActivity(activity -> {
        WebView webView = activity.getBridge().getWebView();
        webView.evaluateJavascript("window.__formaNetworkProbe='pending';fetch('https://forma-mobi-2026-4e7c1a.web.app/api/recognizeMeal',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer invalid'},body:JSON.stringify({data:{}})}).then(r=>window.__formaNetworkProbe='HTTP '+r.status).catch(e=>window.__formaNetworkProbe='NETWORK '+String(e));true", ignored -> {});
      });
      long deadline = System.currentTimeMillis() + 20000;
      while (System.currentTimeMillis() < deadline) {
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript("window.__formaNetworkProbe", value::set));
        if (value.get().contains("HTTP 401") || value.get().contains("NETWORK")) break;
        Thread.sleep(250);
      }
      assertTrue("Expected a callable HTTP response, got " + value.get(), value.get().contains("HTTP 401"));
    }
  }
}
