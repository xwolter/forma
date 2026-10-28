package pl.forma.dziennik;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;

@CapacitorPlugin(name="FormaUpdater")
public class FormaUpdaterPlugin extends Plugin {
    public static final String ORIGIN="https://forma-mobi-2026-4e7c1a.web.app";
    private static final long LIMIT=100L*1024*1024;
    private File candidate;
    private String token;
    private JSObject candidateInfo;
    private final java.util.concurrent.atomic.AtomicBoolean preparing=new java.util.concurrent.atomic.AtomicBoolean(false);
    private boolean beginPreparation(PluginCall call){if(!preparing.compareAndSet(false,true)){call.reject("Aktualizacja jest już przygotowywana.");return false;}return true;}
    private File updateDirectory() throws IOException {
        candidate=null;token=null;candidateInfo=null;
        File dir=new File(getContext().getCacheDir(),"updates");
        if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Brak miejsca na aktualizację.");
        File[] old=dir.listFiles();if(old!=null)for(File f:old)if(f.isFile()&&f.getName().endsWith(".apk")&&!f.delete())throw new IOException("Nie można przygotować pamięci aktualizacji.");
        return dir;
    }
    private long code(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
    private PackageInfo installed() throws Exception{return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);}
    private boolean installAllowed(){return Build.VERSION.SDK_INT<26||getContext().getPackageManager().canRequestPackageInstalls();}
    private HttpURLConnection connect(String address) throws Exception {
        URI u=new URI(address);
        if(!"https".equals(u.getScheme())||!"forma-mobi-2026-4e7c1a.web.app".equals(u.getHost())||u.getPort()!=-1||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!u.getPath().startsWith("/releases/"))throw new IOException("Nieprawidłowy adres aktualizacji.");
        HttpURLConnection c=(HttpURLConnection)u.toURL().openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(20000);c.setRequestProperty("Cache-Control","no-cache");
        if(c.getResponseCode()!=200){c.disconnect();throw new IOException("Serwer aktualizacji jest niedostępny. Spróbuj ponownie później.");}return c;
    }
    private JSONObject manifest() throws Exception {
        HttpURLConnection c=connect(ORIGIN+"/releases/latest.json");
        try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>16384)throw new IOException("Nieprawidłowe informacje o wydaniu.");out.write(b,0,n);}
            JSONObject m=new JSONObject(out.toString("UTF-8"));
            if(m.optInt("schema")!=1||!getContext().getPackageName().equals(m.optString("packageName"))||m.optLong("versionCode")<1||m.optLong("versionCode")>Integer.MAX_VALUE||!m.optString("version").matches("\\d+\\.\\d+\\.\\d+")||!m.optString("sha256").matches("[a-fA-F0-9]{64}")||m.optLong("bytes")<=0||m.optLong("bytes")>LIMIT||!m.optString("url").equals(ORIGIN+"/releases/FORMA-"+m.optString("version")+".apk"))throw new IOException("Nieprawidłowe informacje o wydaniu.");
            return m;
        }finally{c.disconnect();}
    }
    @PluginMethod public void status(PluginCall call){try{PackageInfo p=installed();JSObject r=new JSObject();r.put("version",p.versionName);r.put("versionCode",code(p));r.put("installAllowed",installAllowed());call.resolve(r);}catch(Exception e){call.reject("Nie udało się odczytać wersji aplikacji.");}}
    @PluginMethod public void check(PluginCall call){getBridge().execute(()->{try{JSONObject m=manifest();JSObject r=new JSObject(m.toString());r.put("available",m.getLong("versionCode")>code(installed()));call.resolve(r);}catch(Exception e){call.reject(e.getMessage());}});}
    private String hash(File f) throws Exception {MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)md.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte v:md.digest())s.append(String.format(Locale.ROOT,"%02x",v&255));return s.toString();}
    private JSObject validate(File file) throws Exception {
        if(file.length()<=0||file.length()>LIMIT)throw new IOException("Plik APK jest pusty lub zbyt duży.");
        PackageManager pm=getContext().getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo next=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags), current=pm.getPackageInfo(getContext().getPackageName(),flags);
        if(next==null||!current.packageName.equals(next.packageName))throw new IOException("To nie jest aktualizacja FORMA.");
        if(code(next)<=code(current))throw new IOException("Wybierz nowszą wersję FORMA. Obecnie masz "+current.versionName+".");
        if(Build.VERSION.SDK_INT>=24&&next.applicationInfo!=null&&next.applicationInfo.minSdkVersion>Build.VERSION.SDK_INT)throw new IOException("Ta wersja wymaga nowszego Androida.");
        Signature[] a=Build.VERSION.SDK_INT>=28&&next.signingInfo!=null?next.signingInfo.getApkContentsSigners():next.signatures;
        Signature[] b=Build.VERSION.SDK_INT>=28&&current.signingInfo!=null?current.signingInfo.getApkContentsSigners():current.signatures;
        if(a==null||b==null||a.length!=b.length||!new HashSet<>(Arrays.asList(a)).equals(new HashSet<>(Arrays.asList(b))))throw new IOException("Podpis pliku nie zgadza się z podpisem FORMA. Instalacja zablokowana.");
        JSObject info=new JSObject();info.put("version",next.versionName);info.put("versionCode",code(next));info.put("bytes",file.length());info.put("sha256",hash(file));return info;
    }
    private void ready(PluginCall call,File file,JSONObject expected) throws Exception {
        JSObject info=validate(file);
        if(expected!=null&&(info.getLong("versionCode")!=expected.getLong("versionCode")||!info.getString("version").equals(expected.getString("version"))||file.length()!=expected.getLong("bytes")||!info.getString("sha256").equalsIgnoreCase(expected.getString("sha256"))))throw new IOException("Plik aktualizacji jest uszkodzony lub inny niż opisany. Pobierz go ponownie.");
        candidate=file;token=UUID.randomUUID().toString();candidateInfo=info;info.put("token",token);call.resolve(info);
    }
    @PluginMethod public void download(PluginCall call){if(!beginPreparation(call))return;getBridge().execute(()->{
        File f=null;try{
            JSONObject m=manifest();if(m.getLong("versionCode")<=code(installed()))throw new IOException("Masz aktualną wersję FORMA.");
            File dir=updateDirectory();f=new File(dir,"update-"+UUID.randomUUID()+".apk");
            HttpURLConnection c=connect(m.getString("url"));long total=0,last=0;
            try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(f)){
                byte[] bytes=new byte[65536];int n;while((n=in.read(bytes))!=-1){total+=n;if(total>m.getLong("bytes")||total>LIMIT)throw new IOException("Plik aktualizacji ma nieprawidłowy rozmiar.");out.write(bytes,0,n);if(total-last>262144){JSObject progress=new JSObject();progress.put("received",total);progress.put("total",m.getLong("bytes"));notifyListeners("progress",progress);last=total;}}
            }finally{c.disconnect();}
            ready(call,f,m);
        }catch(Exception e){if(f!=null)f.delete();call.reject(e.getMessage()==null?"Nie udało się pobrać aktualizacji.":e.getMessage());}finally{preparing.set(false);}
    });}
    @PluginMethod public void choose(PluginCall call){if(!beginPreparation(call))return;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/vnd.android.package-archive","application/octet-stream"});startActivityForResult(call,intent,"chosen");}
    @ActivityCallback private void chosen(PluginCall call,ActivityResult result){
        if(call==null){preparing.set(false);return;}if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){preparing.set(false);call.resolve();return;}
        Uri uri=result.getData().getData();if(uri==null){preparing.set(false);call.reject("Nie wybrano pliku.");return;}
        getBridge().execute(()->{File f=null;try{File dir=updateDirectory();f=new File(dir,"local-"+UUID.randomUUID()+".apk");try(InputStream in=getContext().getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(f)){if(in==null)throw new IOException("Nie można odczytać pliku.");byte[] b=new byte[65536];int n;long total=0;while((n=in.read(b))!=-1){total+=n;if(total>LIMIT)throw new IOException("Plik jest zbyt duży.");out.write(b,0,n);}}ready(call,f,null);}catch(Exception e){if(f!=null)f.delete();call.reject(e.getMessage());}finally{preparing.set(false);}});
    }
    @PluginMethod public void install(PluginCall call){
        if(preparing.get()){call.reject("Poczekaj na sprawdzenie aktualizacji.");return;}
        if(candidate==null||token==null||!token.equals(call.getString("token"))){call.reject("Najpierw pobierz aktualizację lub wybierz APK.");return;}
        try{
            JSObject info=validate(candidate);if(!info.getString("sha256").equals(candidateInfo.getString("sha256")))throw new IOException("Plik zmienił się po sprawdzeniu. Pobierz go ponownie.");
            if(!installAllowed()){Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName()));getActivity().startActivity(settings);JSObject r=new JSObject();r.put("needsPermission",true);call.resolve(r);return;}
            Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",candidate);
            Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);JSObject r=new JSObject();r.put("needsPermission",false);call.resolve(r);
        }catch(Exception e){call.reject(e.getMessage());}
    }
}
