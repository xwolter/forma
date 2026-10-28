package pl.forma.dziennik;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.StatFs;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

@CapacitorPlugin(name="FormaFoodCatalog")
public class FormaFoodCatalogPlugin extends Plugin {
    private static final String ORIGIN="https://forma-mobi-2026-4e7c1a.web.app";
    private static final String MANIFEST=ORIGIN+"/catalog/latest.json";
    private static final long MAX_DOWNLOAD=2L*1024*1024*1024;
    private static final long MAX_DATABASE=3L*1024*1024*1024;
    private final AtomicBoolean downloading=new AtomicBoolean(false);
    private volatile boolean cancelled=false;

    private File directory(){return new File(getContext().getFilesDir(),"food-catalog");}
    private File databaseFile(){return new File(directory(),"off-products.sqlite");}
    private File versionFile(){return new File(directory(),"version.txt");}
    private SQLiteDatabase open(){return SQLiteDatabase.openDatabase(databaseFile().getAbsolutePath(),null,SQLiteDatabase.OPEN_READONLY);}
    private static String string(Cursor c,int index){return c.isNull(index)?"":c.getString(index);}
    private static Object number(Cursor c,int index){return c.isNull(index)?JSONObject.NULL:c.getDouble(index);}
    private static JSObject product(Cursor c){
        JSObject p=new JSObject();
        p.put("code",string(c,0));p.put("name",string(c,1));p.put("brand",string(c,2));
        p.put("kcal",number(c,3));p.put("protein",number(c,4));p.put("fat",number(c,5));p.put("carbs",number(c,6));
        p.put("photo",string(c,7));p.put("serving",string(c,8));p.put("servingGrams",number(c,9));
        p.put("modified",c.isNull(10)?0:c.getLong(10));
        return p;
    }
    private static final String COLUMNS="p.code,p.name,p.brand,p.kcal,p.protein,p.fat,p.carbs,p.image_url,p.serving_size,p.serving_grams,p.modified";
    private static String fold(String text){
        String value=Normalizer.normalize(text.toLowerCase(Locale.forLanguageTag("pl")).replace('ł','l'),Normalizer.Form.NFD);
        return value.replaceAll("\\p{M}+","");
    }
    private static String query(String text){
        Matcher matcher=Pattern.compile("[a-z0-9]{2,}").matcher(fold(text));
        ArrayList<String> terms=new ArrayList<>();
        while(matcher.find()&&terms.size()<8)terms.add(matcher.group()+"*");
        return String.join(" ",terms);
    }
    private HttpURLConnection connection(String address) throws Exception {
        URL url=new URL(address);
        if(!"https".equals(url.getProtocol())||!"forma-mobi-2026-4e7c1a.web.app".equals(url.getHost())||url.getPort()!=-1||url.getUserInfo()!=null||url.getQuery()!=null||url.getRef()!=null||!url.getPath().startsWith("/catalog/"))throw new IOException("Nieprawidłowy adres katalogu.");
        HttpURLConnection conn=(HttpURLConnection)url.openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(30000);conn.setRequestProperty("Accept-Encoding","identity");
        if(conn.getResponseCode()!=200){conn.disconnect();throw new IOException("Katalog jest chwilowo niedostępny.");}
        return conn;
    }
    private JSONObject manifest() throws Exception {
        HttpURLConnection conn=connection(MANIFEST);
        try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(out.size()+n>16384)throw new IOException("Nieprawidłowy opis katalogu.");out.write(buf,0,n);}
            JSONObject m=new JSONObject(out.toString("UTF-8"));
            String expected=ORIGIN+"/catalog/off-products-"+m.optString("version")+".sqlite.gz";
            if(m.optInt("schema")!=1||!m.optString("version").matches("[0-9]{4}-[0-9]{2}")||!m.optString("url").equals(expected)||!m.optString("sha256").matches("[0-9a-f]{64}")||m.optLong("bytes")<=0||m.optLong("bytes")>MAX_DOWNLOAD||m.optLong("databaseBytes")<=0||m.optLong("databaseBytes")>MAX_DATABASE||m.optLong("products")<1000000||m.optLong("withCalories")<500000)throw new IOException("Nieprawidłowy opis katalogu.");
            return m;
        }finally{conn.disconnect();}
    }
    private static String hex(byte[] input){StringBuilder result=new StringBuilder();for(byte b:input)result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();}
    private JSObject statusInfo(){
        JSObject result=new JSObject();File file=databaseFile();result.put("available",file.isFile()&&versionFile().isFile());result.put("bytes",file.isFile()?file.length():0);
        if(versionFile().isFile())try(BufferedReader in=new BufferedReader(new FileReader(versionFile()))){result.put("version",in.readLine());}catch(IOException ignored){}
        return result;
    }
    @PluginMethod public void status(PluginCall call){call.resolve(statusInfo());}
    @PluginMethod public void check(PluginCall call){getBridge().execute(()->{try{JSONObject m=manifest();JSObject info=new JSObject(m.toString());info.put("installed",statusInfo());call.resolve(info);}catch(Exception e){call.reject(e.getMessage());}});}
    @PluginMethod public void cancel(PluginCall call){cancelled=true;call.resolve();}
    @PluginMethod public void download(PluginCall call){
        if(!downloading.compareAndSet(false,true)){call.reject("Pobieranie katalogu już trwa.");return;}
        cancelled=false;
        getBridge().execute(()->{
            File temp=null;HttpURLConnection conn=null;
            try{
                JSONObject m=manifest();File dir=directory();if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Brak miejsca na katalog.");
                StatFs storage=new StatFs(dir.getAbsolutePath());if(storage.getAvailableBytes()<m.getLong("databaseBytes")+100L*1024*1024)throw new IOException("Za mało wolnego miejsca w pamięci telefonu.");
                temp=new File(dir,"incoming.sqlite");if(temp.exists()&&!temp.delete())throw new IOException("Nie można przygotować miejsca na katalog.");
                conn=connection(m.getString("url"));MessageDigest digest=MessageDigest.getInstance("SHA-256");
                Counter counter=new Counter(conn.getInputStream());
                long written=0,lastReported=0;
                try(InputStream compressed=new DigestInputStream(counter,digest);GZIPInputStream gzip=new GZIPInputStream(compressed,65536);OutputStream out=new BufferedOutputStream(new FileOutputStream(temp),65536)){
                    byte[] buf=new byte[65536];int n;
                    while((n=gzip.read(buf))!=-1){
                        if(cancelled)throw new IOException("Pobieranie anulowane.");
                        written+=n;if(written>m.getLong("databaseBytes")||counter.count>m.getLong("bytes"))throw new IOException("Nieprawidłowy rozmiar katalogu.");
                        out.write(buf,0,n);
                        if(counter.count-lastReported>=1024*1024){JSObject progress=new JSObject();progress.put("received",counter.count);progress.put("total",m.getLong("bytes"));notifyListeners("progress",progress);lastReported=counter.count;}
                    }
                }
                if(counter.count!=m.getLong("bytes")||written!=m.getLong("databaseBytes")||!hex(digest.digest()).equals(m.getString("sha256")))throw new IOException("Katalog nie przeszedł sprawdzenia. Pobierz ponownie.");
                try(SQLiteDatabase db=SQLiteDatabase.openDatabase(temp.getAbsolutePath(),null,SQLiteDatabase.OPEN_READONLY)){
                    try(Cursor check=db.rawQuery("PRAGMA quick_check",null)){if(!check.moveToFirst()||!"ok".equals(check.getString(0)))throw new IOException("Katalog jest uszkodzony.");}
                    try(Cursor count=db.rawQuery("SELECT COUNT(*),SUM(CASE WHEN kcal IS NOT NULL THEN 1 ELSE 0 END) FROM products",null)){if(!count.moveToFirst()||count.getLong(0)!=m.getLong("products")||count.getLong(1)!=m.getLong("withCalories"))throw new IOException("Katalog jest niekompletny.");}
                }
                File target=databaseFile();if(target.exists()&&!target.delete())throw new IOException("Nie można zastąpić starego katalogu.");
                if(!temp.renameTo(target))throw new IOException("Nie udało się zapisać katalogu.");
                try(FileWriter writer=new FileWriter(versionFile(),false)){writer.write(m.getString("version")+"\n");}
                JSObject result=statusInfo();result.put("products",m.getLong("products"));result.put("withCalories",m.getLong("withCalories"));call.resolve(result);
            }catch(Exception e){if(temp!=null&&temp.exists())temp.delete();call.reject(e.getMessage()==null?"Nie udało się pobrać katalogu.":e.getMessage());}
            finally{if(conn!=null)conn.disconnect();downloading.set(false);cancelled=false;}
        });
    }
    @PluginMethod public void search(PluginCall call){getBridge().execute(()->{
        if(!databaseFile().isFile()){call.reject("Najpierw pobierz pełny katalog.");return;}
        String text=call.getString("query","");int page=call.getInt("page",1);int store=call.getInt("storeMask",0);String match=query(text);
        if(text.length()<2||text.length()>100||match.isEmpty()||page<1||page>1000||(store!=0&&(store>512||Integer.bitCount(store)!=1))){call.reject("Nieprawidłowe wyszukiwanie.");return;}
        String sql="SELECT "+COLUMNS+" FROM search s JOIN products p ON p.rowid=s.docid WHERE search MATCH ? AND p.kcal IS NOT NULL"+(store==0?"":" AND (p.store_mask & ?) != 0")+" LIMIT 51 OFFSET ?";
        String[] args=store==0?new String[]{match,String.valueOf((page-1)*50)}:new String[]{match,String.valueOf(store),String.valueOf((page-1)*50)};
        try(SQLiteDatabase db=open();Cursor cursor=db.rawQuery(sql,args)){
            JSArray products=new JSArray();int n=0;while(cursor.moveToNext()){if(n++<50)products.put(product(cursor));}
            JSObject result=new JSObject();result.put("products",products);result.put("page",page);result.put("hasMore",n>50);call.resolve(result);
        }catch(Exception e){android.util.Log.e("FormaFoodCatalog","Search failed",e);call.reject("Nie udało się przeszukać katalogu ("+e.getClass().getSimpleName()+").");}
    });}
    @PluginMethod public void barcode(PluginCall call){getBridge().execute(()->{
        if(!databaseFile().isFile()){call.reject("Najpierw pobierz pełny katalog.");return;}
        String code=call.getString("code","");if(!code.matches("[0-9]{8}|[0-9]{12,14}")){call.reject("Nieprawidłowy kod.");return;}
        try(SQLiteDatabase db=open();Cursor cursor=db.rawQuery("SELECT "+COLUMNS+" FROM products p WHERE p.code=? LIMIT 1",new String[]{code})){
            JSObject result=new JSObject();result.put("found",cursor.moveToFirst());if(!cursor.isClosed()&&cursor.getPosition()==0)result.put("product",product(cursor));call.resolve(result);
        }catch(Exception e){android.util.Log.e("FormaFoodCatalog","Barcode lookup failed",e);call.reject("Nie udało się odczytać produktu ("+e.getClass().getSimpleName()+").");}
    });}
    private static class Counter extends FilterInputStream {
        long count=0;Counter(InputStream in){super(in);}
        @Override public int read() throws IOException {int value=super.read();if(value!=-1)count++;return value;}
        @Override public int read(byte[] b,int off,int len) throws IOException {int n=super.read(b,off,len);if(n>0)count+=n;return n;}
    }
}
