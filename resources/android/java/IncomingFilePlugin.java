package __APP_ID__;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/** Recibe archivos desde "Abrir con" de otras apps y los entrega a la web. */
@CapacitorPlugin(name = "IncomingFile")
public class IncomingFilePlugin extends Plugin {
    private Intent pending;

    @Override
    public void load() {
        Intent i = getActivity().getIntent();
        if (isFileIntent(i)) setPending(i);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (isFileIntent(intent)) {
            setPending(intent);
            notifyListeners("fileOpened", new JSObject());
        }
    }

    private synchronized void setPending(Intent i) { pending = i; }

    private synchronized Intent takePending() {
        Intent i = pending;
        pending = null;
        return i;
    }

    private boolean isFileIntent(Intent i) {
        return i != null
            && Intent.ACTION_VIEW.equals(i.getAction())
            && i.getData() != null
            && (i.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0;
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject res = new JSObject();
        Intent i = takePending();
        if (i != null) {
            try {
                copyToCache(i, res);
            } catch (Exception e) {
                res.put("error", String.valueOf(e.getMessage()));
            }
            getActivity().setIntent(new Intent());
        }
        call.resolve(res);
    }

    private void copyToCache(Intent i, JSObject res) throws Exception {
        Uri uri = i.getData();
        ContentResolver cr = getContext().getContentResolver();
        String mime = i.getType() != null ? i.getType() : cr.getType(uri);
        String name = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (c != null && c.moveToFirst()) name = c.getString(0);
            } catch (Exception ignored) { }
        }
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()) name = "documento";
        String ext = extFor(name, mime);
        if (!name.toLowerCase(Locale.ROOT).endsWith("." + ext)) name = name + "." + ext;

        File dir = new File(getContext().getCacheDir(), "incoming");
        dir.mkdirs();
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete();
        File out = new File(dir, "doc_" + System.currentTimeMillis() + "." + ext);

        try (InputStream in = cr.openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
            if (in == null) throw new Exception("No se pudo leer el archivo");
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        }
        res.put("path", out.getAbsolutePath());
        res.put("name", name);
    }

    private String extFor(String name, String mime) {
        int d = name.lastIndexOf('.');
        if (d >= 0 && d < name.length() - 1) {
            String e = name.substring(d + 1).toLowerCase(Locale.ROOT);
            if (e.matches("[a-z0-9]{1,5}")) return e;
        }
        if (mime == null) return "bin";
        if (mime.contains("pdf")) return "pdf";
        if (mime.contains("wordprocessingml")) return "docx";
        if (mime.contains("spreadsheetml")) return "xlsx";
        if (mime.contains("presentationml")) return "pptx";
        if (mime.contains("ms-excel")) return "xls";
        if (mime.contains("csv") || mime.contains("comma-separated")) return "csv";
        if (mime.startsWith("text/")) return "txt";
        return "bin";
    }

    /** Alternativa por si la web no puede leer el archivo por URL. */
    @PluginMethod
    public void readBase64(PluginCall call) {
        try {
            String p = call.getString("path");
            File f = new File(p).getCanonicalFile();
            File dir = new File(getContext().getCacheDir(), "incoming").getCanonicalFile();
            if (!f.getPath().startsWith(dir.getPath())) {
                call.reject("Ruta no permitida");
                return;
            }
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            try (InputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            }
            JSObject res = new JSObject();
            res.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
            call.resolve(res);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
