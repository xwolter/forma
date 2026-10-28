package pl.forma.dziennik;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** System chronometer keeps time without polling, wakelocks or media sessions. */
public final class WorkoutNotification {
 public static final int ID=9021;
 public static final String CHANNEL="forma_workout_live";
 private static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("forma_workout_live",Context.MODE_PRIVATE);}
 public static synchronized JSONArray pending(Context c){try{return new JSONArray(prefs(c).getString("pending","[]"));}catch(Exception e){return new JSONArray();}}
 private static JSONObject base(Context c){try{return new JSONObject(prefs(c).getString("snapshot","{}"));}catch(Exception e){return new JSONObject();}}
 static JSONObject control(JSONObject s,String action,long at)throws Exception{
  JSONObject r=new JSONObject(s.toString());String status=r.optString("status");long time=Math.max(r.optLong("startedAt"),at);
  if(action.equals("pause")&&status.equals("active")){r.put("status","paused").put("pausedAt",time).put("restRemaining",Math.max(0,r.optLong("restEndsAt")-time)).put("restEndsAt",0);}
  else if(action.equals("resume")&&status.equals("paused")){r.put("status","active").put("pausedMs",r.optLong("pausedMs")+Math.max(0,time-r.optLong("pausedAt",time))).put("pausedAt",0).put("restEndsAt",r.optLong("restRemaining")>0?time+r.optLong("restRemaining"):0).put("restRemaining",0);}
  else if(status.equals("active")){
   if(action.equals("start-rest"))r.put("restEndsAt",r.optLong("restSeconds",90)>0?time+r.optLong("restSeconds",90)*1000:0);
   if(action.equals("skip-rest"))r.put("restEndsAt",0).put("restRemaining",0);
   if(action.equals("extend-rest"))r.put("restEndsAt",Math.max(time,r.optLong("restEndsAt"))+30000);
  }
  return r;
 }
 public static synchronized JSONObject snapshot(Context c){JSONObject s=base(c);JSONArray q=pending(c);for(int i=0;i<q.length();i++){JSONObject a=q.optJSONObject(i);try{if(a!=null&&s.optString("id").equals(a.optString("sessionId")))s=control(s,a.optString("action"),a.optLong("at"));}catch(Exception ignored){}}return s;}
 public static synchronized void publish(Context c,JSONObject snapshot,JSONArray applied){
  Set<String> ids=new HashSet<>();for(int i=0;i<applied.length();i++)ids.add(applied.optString(i));JSONArray remain=new JSONArray(),q=pending(c);for(int i=0;i<q.length();i++){JSONObject a=q.optJSONObject(i);if(a!=null&&!ids.contains(a.optString("id")))remain.put(a);}
  boolean wasDisabled=!base(c).optBoolean("enabled");android.content.SharedPreferences.Editor edit=prefs(c).edit().putString("snapshot",snapshot.toString()).putString("pending",remain.toString());if(wasDisabled&&snapshot.optBoolean("enabled"))edit.remove("dismissed");edit.commit();show(c);
 }
 public static synchronized void clear(Context c){prefs(c).edit().clear().commit();show(c);}
 public static synchronized void action(Context c,String sessionId,String action){
  if(sessionId==null||action==null)return;JSONObject s=snapshot(c);if(!s.optString("id").equals(sessionId)||sessionId.isEmpty())return;
  if(action.equals("dismiss")){prefs(c).edit().putString("dismissed",sessionId).commit();return;}
  if(action.equals("rest-elapsed")){show(c);return;}
  if(!java.util.Arrays.asList("pause","resume","start-rest","skip-rest","extend-rest").contains(action)||!java.util.Arrays.asList("active","paused").contains(s.optString("status")))return;
  JSONArray q=pending(c);if(q.length()>=500)return;try{q.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("sessionId",sessionId).put("action",action).put("at",System.currentTimeMillis()));prefs(c).edit().putString("pending",q.toString()).commit();show(c);}catch(Exception ignored){}
 }
 static PendingIntent actionIntent(Context c,String id,String action){Intent i=new Intent(c,WorkoutActionReceiver.class).setData(Uri.parse("forma-workout://control/"+Uri.encode(id)+"/"+action)).putExtra("sessionId",id).putExtra("action",action);return PendingIntent.getBroadcast(c,action.hashCode(),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private static String duration(long ms){long s=Math.max(0,ms/1000);return String.format(Locale.ROOT,"%d:%02d",s/60,s%60);}
 public static synchronized void show(Context c){
  NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(manager==null)return;JSONObject s=snapshot(c);String id=s.optString("id"),status=s.optString("status");boolean paused=status.equals("paused");
  if(id.isEmpty()||!s.optBoolean("enabled")||!java.util.Arrays.asList("active","paused").contains(status)||id.equals(prefs(c).getString("dismissed",""))){manager.cancel(ID);return;}
  if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"Trening w toku",NotificationManager.IMPORTANCE_LOW);channel.setDescription("Czas treningu, pauza i sterowanie przerwą");channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);}
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);long now=System.currentTimeMillis(),end=s.optLong("restEndsAt"),elapsed=(paused?s.optLong("pausedAt",now):now)-s.optLong("startedAt",now)-s.optLong("pausedMs");boolean rest=!paused&&end>now;
  int done=Math.max(0,s.optInt("done")),total=Math.max(0,s.optInt("total"));
  String title=s.optString("title","Trening FORMA");
  String phase=rest?"Przerwa":paused?"Wstrzymano":"Trwa";
  String body=phase+" · "+done+"/"+total+" serii"+(paused?" · "+duration(elapsed):"");
  String exercise=s.optString("exercise","");
  b.setSmallIcon(R.drawable.ic_workout).setContentTitle(title+" · "+phase).setContentText(body).setSubText("FORMA · "+phase).setOnlyAlertOnce(true).setOngoing(true).setAutoCancel(false).setColor(rest?0xff1c62a8:paused?0xff8a5a00:0xff1d7a4a).setColorized(false).setCategory(Notification.CATEGORY_STATUS).setVisibility(Notification.VISIBILITY_PRIVATE);
  b.setProgress(Math.max(1,total),Math.min(done,Math.max(1,total)),false);
  if(!exercise.isEmpty())b.setStyle(new Notification.BigTextStyle().bigText(body+"\n"+exercise));
  Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("forma_route","training");b.setContentIntent(PendingIntent.getActivity(c,9021,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).setDeleteIntent(actionIntent(c,id,"dismiss"));
  if(!paused){b.setShowWhen(true).setUsesChronometer(true).setWhen(rest?end:s.optLong("startedAt",now)+s.optLong("pausedMs"));if(Build.VERSION.SDK_INT>=24)b.setChronometerCountDown(rest);}else b.setShowWhen(false);
  b.addAction(paused?R.drawable.ic_widget_play:R.drawable.ic_widget_pause,paused?"Wznów":"Pauza",actionIntent(c,id,paused?"resume":"pause"));if(!paused){b.addAction(rest?R.drawable.ic_widget_play:R.drawable.ic_workout,rest?"Pomiń":"Przerwa",actionIntent(c,id,rest?"skip-rest":"start-rest"));if(rest)b.addAction(R.drawable.ic_widget_plus,"+30 s",actionIntent(c,id,"extend-rest"));}
  Bundle extras=new Bundle();extras.putBoolean("android.requestPromotedOngoing",true);b.addExtras(extras);if(Build.VERSION.SDK_INT>=36)try{Notification.Builder.class.getMethod("setShortCriticalText",String.class).invoke(b,paused?"Pauza":rest?null:"Trening");}catch(Exception ignored){}
  Notification.Builder pub=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);b.setPublicVersion(pub.setSmallIcon(R.drawable.ic_workout).setContentTitle("FORMA").setContentText(paused?"Trening wstrzymany":"Trening w toku").build());try{manager.notify(ID,b.build());}catch(SecurityException ignored){}
  if(rest){AlarmManager alarm=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);if(alarm!=null){PendingIntent intent=actionIntent(c,id,"rest-elapsed");try{if(Build.VERSION.SDK_INT>=23)alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,end,intent);else alarm.set(AlarmManager.RTC_WAKEUP,end,intent);}catch(Exception ignored){}}}
 }
}
