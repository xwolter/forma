package pl.forma.dziennik;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Snapshot for RemoteViews; water actions stay queued until IndexedDB commits them. */
public final class WidgetState {
    private static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("forma_widgets", Context.MODE_PRIVATE); }
    public static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date()); }
    public static synchronized JSONArray pending(Context c) {
        try { return new JSONArray(prefs(c).getString("pending", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    public static synchronized JSONObject snapshot(Context c) {
        try { return new JSONObject(prefs(c).getString("snapshot", "{}")); } catch (Exception e) { return new JSONObject(); }
    }
    public static synchronized int water(Context c) {
        JSONObject s=snapshot(c); String today=today();
        int value=today.equals(s.optString("date"))?s.optInt("water",0):0;
        JSONArray queue=pending(c);
        for(int i=0;i<queue.length();i++){JSONObject a=queue.optJSONObject(i);if(a!=null&&today.equals(a.optString("date")))value=Math.max(0,Math.min(100000,value+a.optInt("delta")));}
        return value;
    }
    public static synchronized void adjust(Context c,int requested) {
        if(requested!=250&&requested!=-250)return;
        JSONObject s=snapshot(c); if(!s.optBoolean("configured",false))return;
        JSONArray queue=pending(c); if(queue.length()>=500){prefs(c).edit().putBoolean("queueFull",true).commit();return;}
        int before=water(c), delta=Math.max(0,Math.min(100000,before+requested))-before;
        if(delta==0)return;
        try {queue.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("date",today()).put("delta",delta));prefs(c).edit().putString("pending",queue.toString()).commit();}catch(Exception ignored){}
    }
    public static synchronized void publish(Context c,JSONObject snapshot,JSONArray applied) {
        Set<String> ids=new HashSet<>();for(int i=0;i<applied.length();i++)ids.add(applied.optString(i));
        JSONArray remaining=new JSONArray(), queue=pending(c);
        for(int i=0;i<queue.length();i++){JSONObject a=queue.optJSONObject(i);if(a!=null&&!ids.contains(a.optString("id")))remaining.put(a);}
        prefs(c).edit().putString("snapshot",snapshot.toString()).putString("pending",remaining.toString()).putBoolean("queueFull",false).commit();
    }
    public static synchronized void clear(Context c){prefs(c).edit().clear().commit();}
    public static boolean queueFull(Context c){return prefs(c).getBoolean("queueFull",false);}
}
