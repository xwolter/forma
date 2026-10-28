package pl.forma.dziennik;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="FormaWidgets")
public class FormaWidgetsPlugin extends Plugin {
    @PluginMethod public void pending(PluginCall call){JSObject r=new JSObject();r.put("actions",WidgetState.pending(getContext()));call.resolve(r);}
    @PluginMethod public void publish(PluginCall call){
        JSObject snapshot=call.getObject("snapshot");JSArray applied=call.getArray("applied",new JSArray());
        if(snapshot==null||!snapshot.optString("date").matches("\\d{4}-\\d{2}-\\d{2}")||snapshot.optDouble("water",-1)<0||snapshot.optDouble("water",100001)>100000){call.reject("Nieprawidłowe dane widżetu.");return;}
        WidgetState.publish(getContext(),snapshot,applied);FormaWidgetProvider.refresh(getContext());call.resolve();
    }
    @PluginMethod public void clear(PluginCall call){WidgetState.clear(getContext());FormaWidgetProvider.refresh(getContext());call.resolve();}
    @PluginMethod public void pin(PluginCall call){
        if(Build.VERSION.SDK_INT<26||!AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported()){call.reject("Przytrzymaj pusty obszar ekranu głównego, wybierz Widżety i znajdź FORMA.");return;}
        Class<?> cls="water".equals(call.getString("kind"))?FormaWaterWidgetProvider.class:"streak".equals(call.getString("kind"))?FormaStreakWidgetProvider.class:FormaWidgetProvider.class;
        getActivity().runOnUiThread(()->{boolean requested=AppWidgetManager.getInstance(getContext()).requestPinAppWidget(new ComponentName(getContext(),cls),null,null);if(requested)call.resolve();else call.reject("Dodaj widżet z menu ekranu głównego telefonu.");});
    }
    @PluginMethod public void route(PluginCall call){
        Intent intent=getActivity().getIntent();String route=intent.getStringExtra("forma_route");intent.removeExtra("forma_route");
        JSObject r=new JSObject();r.put("route",route==null?"":route);call.resolve(r);
    }
    @Override protected void handleOnNewIntent(Intent intent){getActivity().setIntent(intent);notifyListeners("launch",new JSObject());}
}
