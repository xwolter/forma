package pl.forma.dziennik;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class FormaWidgetProvider extends AppWidgetProvider {
    static final String ADD="pl.forma.dziennik.WATER_ADD", SUBTRACT="pl.forma.dziennik.WATER_SUBTRACT";
    @Override public void onUpdate(Context c,AppWidgetManager manager,int[] ids){refresh(c);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager manager,int id,android.os.Bundle options){refresh(c);}
    @Override public void onReceive(Context c,Intent intent){
        if(ADD.equals(intent.getAction())||SUBTRACT.equals(intent.getAction())){
            WidgetState.adjust(c,ADD.equals(intent.getAction())?250:-250);refresh(c);return;
        }
        super.onReceive(c,intent);
    }
    static PendingIntent open(Context c,String route,int request){
        Intent i=new Intent(c,MainActivity.class).putExtra("forma_route",route).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,request,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent waterAction(Context c,boolean add){
        Intent i=new Intent(c,FormaWaterWidgetProvider.class).setAction(add?ADD:SUBTRACT);
        return PendingIntent.getBroadcast(c,add?101:102,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static RemoteViews views(Context c,boolean water){
        return views(c,water,false);
    }
    static RemoteViews views(Context c,boolean water,boolean compact){
        return views(c,water,compact,compact?160:250,compact?160:220);
    }
    static RemoteViews views(Context c,boolean water,boolean compact,int widthDp,int heightDp){
                RemoteViews v=new RemoteViews(c.getPackageName(),water?(compact?R.layout.widget_water_compact:R.layout.widget_water):(compact?R.layout.widget_day_compact:R.layout.widget_day));
                JSONObject s=WidgetState.snapshot(c);boolean ready=s.optBoolean("configured",false), current=WidgetState.today().equals(s.optString("date"));
                v.setOnClickPendingIntent(R.id.widget_root,open(c,water?"food":"today",water?204:201));
                if(water){
                    int amount=WidgetState.water(c),goal=s.optInt("waterGoal",0);
                    v.setTextViewText(R.id.widget_title,"Woda");
                    v.setTextViewText(R.id.widget_value,ready?number(amount):"—");
                    v.setTextViewText(R.id.widget_goal,ready?(goal>0?"/ "+number(goal)+" ml":"ml · cel nieustawiony"):"Otwórz FORMA");
                    v.setImageViewBitmap(R.id.widget_wave,wave(c,goal>0?amount/(float)goal:Math.min(1f,amount/2500f),widthDp,heightDp));
                    v.setContentDescription(R.id.widget_value,amount+" ml wypitej wody"+(goal>0?", cel "+goal+" ml":""));
                    v.setProgressBar(R.id.widget_progress,Math.max(1,goal),amount,false);
                    v.setOnClickPendingIntent(R.id.widget_plus,waterAction(c,true));v.setOnClickPendingIntent(R.id.widget_minus,waterAction(c,false));
                    v.setTextViewText(R.id.widget_status,!ready?"Skonfiguruj aplikację":WidgetState.queueFull(c)?"Otwórz FORMA, aby zapisać":goal>0?(amount>=goal?"Cel nawodnienia osiągnięty":"Do celu jeszcze "+number(goal-amount)+" ml"):"Dotknij, aby otworzyć dziennik");
                    v.setBoolean(R.id.widget_plus,"setEnabled",ready&&!WidgetState.queueFull(c));v.setBoolean(R.id.widget_minus,"setEnabled",ready&&amount>0&&!WidgetState.queueFull(c));
                }else{
                    v.setTextViewText(R.id.widget_title,compact?"FORMA · Dziś":"FORMA · Dziś");
                    int kcal=current?s.optInt("kcal"):0,goal=s.optInt("goal");
                    v.setTextViewText(R.id.widget_value,ready?number(kcal):"—");
                    v.setTextViewText(R.id.widget_goal,ready?(goal>0?"/ "+number(goal)+" kcal · "+number(Math.max(0,goal-kcal))+" do celu":"Ustaw cel w aplikacji"):"Otwórz FORMA");
                    v.setContentDescription(R.id.widget_value,kcal+" kcal w dzienniku"+(goal>0?", cel "+goal+" kcal":""));
                    v.setImageViewBitmap(R.id.widget_ring,ring(c,kcal,goal));
                    if(!compact){
                        macro(v,R.id.widget_protein,R.id.widget_protein_bar,"Białko",current?s.optDouble("protein"):0,s.optDouble("proteinGoal"));
                        macro(v,R.id.widget_fat,R.id.widget_fat_bar,"Tłuszcz",current?s.optDouble("fat"):0,s.optDouble("fatGoal"));
                        macro(v,R.id.widget_carbs,R.id.widget_carbs_bar,"Węgle",current?s.optDouble("carbs"):0,s.optDouble("carbsGoal"));
                    }
                    JSONObject session=WorkoutNotification.snapshot(c);String status=session.optString("status");
                    boolean live=session.optBoolean("enabled")&&(status.equals("active")||status.equals("paused"));
                    String training=ready?(current?s.optString("trainingName","Twój trening"):"Otwórz FORMA, aby odświeżyć dane"):"Dotknij, aby zacząć";
                    v.setTextViewText(R.id.widget_status,live?(status.equals("paused")?"Pauza · ":"Trening · ")+training+" · "+session.optInt("done")+"/"+session.optInt("total")+" serii":training);
                    v.setViewVisibility(R.id.widget_toggle,View.VISIBLE);
                    v.setImageViewResource(R.id.widget_toggle,live&&status.equals("active")?R.drawable.ic_widget_pause:R.drawable.ic_widget_play);
                    if(!live){v.setContentDescription(R.id.widget_toggle,"Otwórz trening");v.setOnClickPendingIntent(R.id.widget_toggle,open(c,"training",207));}
                    v.setOnClickPendingIntent(R.id.widget_status,open(c,"training",205));
                    if(!compact){
                        v.setViewVisibility(R.id.widget_timer,live?View.VISIBLE:View.GONE);
                        if(live){
                            long now=System.currentTimeMillis(),elapsed=(status.equals("paused")?session.optLong("pausedAt",now):now)-session.optLong("startedAt",now)-session.optLong("pausedMs");
                            v.setChronometer(R.id.widget_timer,SystemClock.elapsedRealtime()-Math.max(0,elapsed),null,status.equals("active"));
                        }
                    }
                    if(live){String action=status.equals("paused")?"resume":"pause";v.setContentDescription(R.id.widget_toggle,status.equals("paused")?"Wznów trening":"Wstrzymaj trening");v.setOnClickPendingIntent(R.id.widget_toggle,WorkoutNotification.actionIntent(c,session.optString("id"),action));}
                    v.setOnClickPendingIntent(R.id.widget_food,open(c,"food-add",202));v.setOnClickPendingIntent(R.id.widget_training,open(c,"progress",203));
                }
        return v;
    }
    static String number(int value){return java.text.NumberFormat.getIntegerInstance(new java.util.Locale("pl","PL")).format(value);}
    static RemoteViews streakViews(Context c){
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.widget_streak);JSONObject s=WidgetState.snapshot(c);
        boolean ready=s.optBoolean("configured",false),current=WidgetState.today().equals(s.optString("date"));
        int count=current?s.optInt("streakOpen"):0,best=s.optInt("streakBest");
        v.setTextViewText(R.id.widget_streak_value,ready?number(count):"—");
        v.setTextViewText(R.id.widget_streak_best,ready?"rekord "+number(best):"FORMA");
        v.setTextViewText(R.id.widget_streak_status,ready?(current?(count==1?"dzień z rzędu":"dni z rzędu"):"Otwórz FORMA, aby odświeżyć"):"Otwórz FORMA, aby zacząć");
        JSONArray days=current?s.optJSONArray("streakDays"):null;
        int[] cells={R.id.widget_streak_d0,R.id.widget_streak_d1,R.id.widget_streak_d2,R.id.widget_streak_d3,R.id.widget_streak_d4,R.id.widget_streak_d5,R.id.widget_streak_d6};
        int[] labels={R.id.widget_streak_l0,R.id.widget_streak_l1,R.id.widget_streak_l2,R.id.widget_streak_l3,R.id.widget_streak_l4,R.id.widget_streak_l5,R.id.widget_streak_l6};
        String[] names={"Nd","Pn","Wt","Śr","Cz","Pt","So"};java.util.Calendar day=java.util.Calendar.getInstance();day.add(java.util.Calendar.DAY_OF_MONTH,-6);
        for(int i=0;i<cells.length;i++){
            boolean done=days!=null&&days.optBoolean(i),today=i==cells.length-1;
            v.setTextViewText(cells[i],done?"✓":"–");
            v.setInt(cells[i],"setBackgroundResource",done?(today?R.drawable.widget_dot_today:R.drawable.widget_dot_done):R.drawable.widget_dot_off);
            v.setTextViewText(labels[i],names[day.get(java.util.Calendar.DAY_OF_WEEK)-1]);day.add(java.util.Calendar.DAY_OF_MONTH,1);
        }
        PendingIntent open=open(c,"progress",206);v.setOnClickPendingIntent(R.id.widget_root,open);v.setOnClickPendingIntent(R.id.widget_streak_open,open);
        return v;
    }
    static void macro(RemoteViews v,int labelId,int barId,String label,double value,double goal){
        int amount=(int)Math.round(Math.max(0,value));
        v.setTextViewText(labelId,label+" "+amount+" g");
        v.setProgressBar(barId,100,goal>0?(int)Math.min(100,Math.round(value*100/goal)):0,false);
    }
    static Bitmap ring(Context c,int value,int goal){
        int size=156;float stroke=18;Bitmap image=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(image);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(stroke);paint.setStrokeCap(Paint.Cap.ROUND);
        RectF bounds=new RectF(stroke/2,stroke/2,size-stroke/2,size-stroke/2);
        paint.setColor(c.getColor(R.color.widget_day_hot_track));canvas.drawArc(bounds,0,360,false,paint);
        if(goal>0&&value>0){paint.setColor(c.getColor(R.color.widget_day_hot));canvas.drawArc(bounds,-90,360*Math.min(1f,value/(float)goal),false,paint);}
        paint.setStyle(Paint.Style.FILL);paint.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.BOLD));
        paint.setTextAlign(Paint.Align.CENTER);
        android.graphics.drawable.Drawable flame=c.getDrawable(R.drawable.ic_widget_flame);
        if(flame!=null){flame.setBounds(62,36,94,75);flame.draw(canvas);}
        paint.setColor(c.getColor(R.color.widget_day_ink));paint.setTextSize(24);
        String label=goal>0?Math.round(value*100f/goal)+"%":"—";if(label.length()>4)paint.setTextSize(20);
        canvas.drawText(label,size/2f,size/2f+42,paint);
        return image;
    }
    // Static frame of the prototype's water animation: two waves at the current fill level, clipped to the card corners.
    static Bitmap wave(Context c,float fraction,int widthDp,int heightDp){
        float scale=2f;int w=Math.max(120,Math.round(widthDp*scale)),h=Math.max(120,Math.round(heightDp*scale));
        Bitmap image=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(image);
        android.graphics.Path clip=new android.graphics.Path();float r=28*scale;clip.addRoundRect(new RectF(0,0,w,h),r,r,android.graphics.Path.Direction.CW);canvas.clipPath(clip);
        float level=h*(1-Math.max(0f,Math.min(1f,fraction))*0.78f-0.06f);
        Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setStyle(Paint.Style.FILL);
        int[] colors={R.color.widget_water_wave2,R.color.widget_water_wave};float[] offsets={-0.04f*h,0};float[] phases={1.3f,0f};
        for(int k=0;k<2;k++){
            android.graphics.Path path=new android.graphics.Path();float y0=level+offsets[k],amp=7*scale;
            path.moveTo(0,h);
            for(int x=0;x<=w;x+=4)path.lineTo(x,y0+(float)Math.sin(x/(float)w*Math.PI*2.4+phases[k])*amp);
            path.lineTo(w,h);path.close();paint.setColor(c.getColor(colors[k]));canvas.drawPath(path,paint);
        }
        return image;
    }
    public static void refresh(Context c){
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        for(Class<?> provider:new Class<?>[]{FormaWidgetProvider.class,FormaWaterWidgetProvider.class,FormaStreakWidgetProvider.class}){
            boolean water=provider==FormaWaterWidgetProvider.class;
            for(int id:manager.getAppWidgetIds(new ComponentName(c,provider))){
                android.os.Bundle options=manager.getAppWidgetOptions(id);
                int height=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,240),width=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,250);
                boolean compact=(height>0&&height<220)||(width>0&&width<220);
                manager.updateAppWidget(id,provider==FormaStreakWidgetProvider.class?streakViews(c):views(c,water,compact,width>0?width:250,height>0?height:220));
            }
        }
    }
}
