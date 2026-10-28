package pl.forma.dziennik;

import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import androidx.core.content.FileProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CameraFileProviderTest {
  @Test public void cameraCanShareItsExternalPicturesFile() throws Exception {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    File directory = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES);
    assertNotNull("Camera photos directory must exist", directory);
    File photo = File.createTempFile("FORMA-camera-test-", ".jpg", directory);
    try {
      Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", photo);
      assertEquals("content", uri.getScheme());
      assertEquals(context.getPackageName() + ".fileprovider", uri.getAuthority());
    } finally {
      assertTrue("Temporary test photo should be removed", photo.delete());
    }
  }
}
