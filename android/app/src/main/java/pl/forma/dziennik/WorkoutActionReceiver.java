package pl.forma.dziennik;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public final class WorkoutActionReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){WorkoutNotification.action(context,intent.getStringExtra("sessionId"),intent.getStringExtra("action"));FormaWidgetProvider.refresh(context);}
}
