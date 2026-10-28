package pl.forma.dziennik;
import android.app.NotificationManager;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="WorkoutNotification")
public final class WorkoutNotificationPlugin extends Plugin {
 @PluginMethod public void pending(PluginCall call){JSObject r=new JSObject();r.put("actions",WorkoutNotification.pending(getContext()));r.put("snapshot",WorkoutNotification.snapshot(getContext()));call.resolve(r);}
 @PluginMethod public void publish(PluginCall call){JSObject s=call.getObject("snapshot");if(s==null||s.toString().length()>12000){call.reject("Nieprawidłowy stan treningu.");return;}WorkoutNotification.publish(getContext(),s,call.getArray("applied",new JSArray()));FormaWidgetProvider.refresh(getContext());call.resolve();}
 @PluginMethod public void clear(PluginCall call){WorkoutNotification.clear(getContext());FormaWidgetProvider.refresh(getContext());call.resolve();}
 @PluginMethod public void status(PluginCall call){JSObject r=new JSObject();r.put("allowed",NotificationManagerCompat.from(getContext()).areNotificationsEnabled());r.put("liveUpdatesSupported",Build.VERSION.SDK_INT>=36);boolean promoted=false;if(Build.VERSION.SDK_INT>=36)try{NotificationManager m=(NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);promoted=(boolean)NotificationManager.class.getMethod("canPostPromotedNotifications").invoke(m);}catch(Exception ignored){}r.put("promotedAllowed",promoted);call.resolve(r);}
}
