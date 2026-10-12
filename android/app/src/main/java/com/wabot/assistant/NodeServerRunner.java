package com.wabot.assistant;

import android.content.Context;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

/**
 * NodeServerRunner
 * Mengelola inisialisasi lingkungan proses embedded Node.js dan pemantauan server lokal (http://127.0.0.1:3000).
 */
public class NodeServerRunner {
    private static final String TAG = "NodeServerRunner";
    public static final String SERVER_URL = "http://127.0.0.1:3000";
    private static final String EXTRACTED_MARKER = ".extracted_build_v5";

    private static volatile String currentStatus = "Menyiapkan sistem bot...";
    private static volatile File appInternalDir = null;

    public static String getCurrentStatus() {
        if (appInternalDir != null) {
            File errFile = new File(appInternalDir, "startup_error.txt");
            if (errFile.exists()) {
                try {
                    byte[] bytes = java.nio.file.Files.readAllBytes(errFile.toPath());
                    String errText = new String(bytes).trim();
                    if (!errText.isEmpty()) {
                        String firstLine = errText.split("\n")[0];
                        return "Kesalahan: " + firstLine;
                    }
                } catch (Exception ignored) {}
            }
        }
        return currentStatus;
    }

    public static void setCurrentStatus(String status) {
        currentStatus = status;
    }

    static {
        try {
            System.loadLibrary("c++_shared");
            System.loadLibrary("node");
            try {
                System.loadLibrary("better_sqlite3");
                Log.i(TAG, "Library better_sqlite3 berhasil dimuat via System.loadLibrary.");
            } catch (Throwable t) {
                Log.w(TAG, "better_sqlite3 dimuat nanti oleh dynamic loader: " + t.getMessage());
            }
            System.loadLibrary("native-lib");
            Log.i(TAG, "Native libraries loaded successfully.");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Gagal memuat native library: " + e.getMessage(), e);
        }
    }

    private native void setEnvironmentVariable(String key, String value);
    private native int startNodeWithArguments(String[] arguments);

    private final Context context;
    private boolean isRunning = false;
    private Thread serverThread;

    public NodeServerRunner(Context context) {
        this.context = context;
    }

    /**
     * Memulai proses server lokal embedded Node.js di background thread.
     */
    public synchronized void startServer() {
        if (isRunning) return;

        isRunning = true;
        currentStatus = "Menyiapkan berkas & direktori kerja...";
        Log.i(TAG, "Menyiapkan environment dan menjalankan server lokal...");

        serverThread = new Thread(() -> {
            try {
                // 1. Siapkan direktori writable internal sandbox Android
                File internalFilesDir = context.getFilesDir();
                appInternalDir = internalFilesDir;

                try {
                    File oldErr = new File(internalFilesDir, "startup_error.txt");
                    if (oldErr.exists()) oldErr.delete();
                    File oldReady = new File(internalFilesDir, "server_ready.txt");
                    if (oldReady.exists()) oldReady.delete();
                } catch (Exception ignored) {}

                File dataDir = new File(internalFilesDir, "data");
                if (!dataDir.exists()) {
                    dataDir.mkdirs();
                }

                File uploadsDir = new File(internalFilesDir, "uploads");
                if (!uploadsDir.exists()) {
                    uploadsDir.mkdirs();
                }

                File projectDir = new File(internalFilesDir, "nodejs-project");
                File markerFile = new File(projectDir, EXTRACTED_MARKER);

                // 2. Ekstrak assets proyek Node.js langsung dari file APK jika belum diekstrak
                if (!markerFile.exists()) {
                    Log.i(TAG, "Mengekstrak aset proyek Node.js dari APK ke " + projectDir.getAbsolutePath() + "...");
                    currentStatus = "Mengekstrak berkas sistem bot...";
                    extractProjectAssets(projectDir);
                    try {
                        markerFile.createNewFile();
                        Log.i(TAG, "Aset berhasil diekstrak dan marker file dibuat.");
                    } catch (IOException e) {
                        Log.w(TAG, "Gagal membuat marker file: " + e.getMessage());
                    }
                } else {
                    Log.i(TAG, "Aset proyek Node.js sudah tersedia, melewati proses ekstraksi.");
                }

                // 3. Konfigurasi Environment Variables ke runtime POSIX
                currentStatus = "Mengonfigurasi environment Node.js...";
                String nativeLibDir = context.getApplicationInfo().nativeLibraryDir;
                File nodeModulesDir = new File(projectDir, "node_modules");

                setEnvironmentVariable("PORT", "3000");
                setEnvironmentVariable("HOST", "127.0.0.1");
                setEnvironmentVariable("ENGINE_TYPE", "baileys");
                setEnvironmentVariable("EDITION", "bisnis");
                setEnvironmentVariable("NODE_ENV", "production");
                setEnvironmentVariable("NO_AUTO_OPEN", "true");
                setEnvironmentVariable("ANDROID_DATA_DIR", internalFilesDir.getAbsolutePath());
                setEnvironmentVariable("ANDROID_NATIVE_LIB_DIR", nativeLibDir);
                setEnvironmentVariable("NODE_PATH", nodeModulesDir.getAbsolutePath());

                Log.i(TAG, "Environment terkonfigurasi. ANDROID_DATA_DIR=" + internalFilesDir.getAbsolutePath()
                        + ", ANDROID_NATIVE_LIB_DIR=" + nativeLibDir);

                // 4. Jalankan Node.js entry point (src/server/index.js)
                File entryScript = new File(projectDir, "src/server/index.js");
                if (!entryScript.exists()) {
                    Log.e(TAG, "Entry script tidak ditemukan di: " + entryScript.getAbsolutePath());
                    currentStatus = "Kesalahan: Entry script bot tidak ditemukan!";
                    isRunning = false;
                    return;
                }

                currentStatus = "Menyalakan server lokal port 3000...";
                Log.i(TAG, "Memulai Node.js dengan script: " + entryScript.getAbsolutePath());
                String[] nodeArgs = new String[]{"node", entryScript.getAbsolutePath()};
                int exitCode = startNodeWithArguments(nodeArgs);

                Log.i(TAG, "Node.js proses selesai dengan exit code: " + exitCode);
                
                File errFile = new File(internalFilesDir, "startup_error.txt");
                if (errFile.exists()) {
                    try {
                        byte[] bytes = java.nio.file.Files.readAllBytes(errFile.toPath());
                        String errText = new String(bytes).trim();
                        if (!errText.isEmpty()) {
                            String firstLine = errText.split("\n")[0];
                            currentStatus = "Error: " + firstLine;
                        } else {
                            currentStatus = "Server bot selesai (exit code: " + exitCode + ")";
                        }
                    } catch (Exception ignored) {
                        currentStatus = "Server bot selesai (exit code: " + exitCode + ")";
                    }
                } else {
                    currentStatus = "Server bot selesai (exit code: " + exitCode + ")";
                }
                isRunning = false;

            } catch (Exception e) {
                Log.e(TAG, "Error saat menjalankan background server: " + e.getMessage(), e);
                currentStatus = "Error: " + e.getMessage();
                isRunning = false;
            }
        });

        serverThread.setName("NodeServerRunnerThread");
        serverThread.start();
    }

    /**
     * Mengekstrak seluruh folder asset nodejs-project dan node_modules.zip langsung dari APK
     * menggunakan ZipFile tanpa batas memori atau kompresi AssetManager, dioptimasi dengan buffered I/O.
     */
    private void extractProjectAssets(File targetDir) {
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }

        String apkPath = context.getPackageCodePath();
        Log.i(TAG, "Membuka container APK untuk ekstraksi: " + apkPath);
        Set<String> createdDirs = new HashSet<>();
        createdDirs.add(targetDir.getAbsolutePath());

        try (ZipFile apkZip = new ZipFile(apkPath)) {
            Enumeration<? extends ZipEntry> entries = apkZip.entries();
            byte[] buffer = new byte[65536]; // Buffer 64 KB untuk performa maksimal

            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String name = entry.getName();

                if (name.startsWith("assets/nodejs-project/")) {
                    String relativePath = name.substring("assets/nodejs-project/".length());
                    if (relativePath.startsWith("./")) {
                        relativePath = relativePath.substring(2);
                    }
                    if (relativePath.isEmpty()) continue;

                    if (relativePath.equals("node_modules.zip")) {
                        Log.i(TAG, "Ditemukan node_modules.zip, melakukan ekstraksi cepat...");
                        currentStatus = "Mengekstrak paket runtime modul bot...";
                        File nodeModulesDir = new File(targetDir, "node_modules");
                        try (InputStream is = apkZip.getInputStream(entry);
                             BufferedInputStream bis = new BufferedInputStream(is, 65536);
                             ZipInputStream zis = new ZipInputStream(bis)) {
                            unzipStream(zis, nodeModulesDir);
                        }
                        Log.i(TAG, "node_modules berhasil diekstrak sepenuhnya!");
                    } else {
                        File outFile = new File(targetDir, relativePath);
                        if (entry.isDirectory()) {
                            if (!createdDirs.contains(outFile.getAbsolutePath())) {
                                outFile.mkdirs();
                                createdDirs.add(outFile.getAbsolutePath());
                            }
                        } else {
                            File parent = outFile.getParentFile();
                            if (parent != null && !createdDirs.contains(parent.getAbsolutePath())) {
                                parent.mkdirs();
                                createdDirs.add(parent.getAbsolutePath());
                            }
                            try (InputStream in = apkZip.getInputStream(entry);
                                 BufferedInputStream bin = new BufferedInputStream(in, 65536);
                                 FileOutputStream out = new FileOutputStream(outFile);
                                 BufferedOutputStream bout = new BufferedOutputStream(out, 65536)) {
                                int read;
                                while ((read = bin.read(buffer)) != -1) {
                                    bout.write(buffer, 0, read);
                                }
                                bout.flush();
                            }
                        }
                    }
                }
            }
            Log.i(TAG, "Ekstraksi proyek Node.js dari APK selesai dengan sukses.");
        } catch (Exception e) {
            Log.e(TAG, "Error saat mengekstrak aset dari APK: " + e.getMessage(), e);
        }
    }

    private static void unzipStream(ZipInputStream zis, File targetDir) throws IOException {
        Set<String> createdDirs = new HashSet<>();
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }
        createdDirs.add(targetDir.getAbsolutePath());

        byte[] buffer = new byte[65536];
        ZipEntry entry;
        int fileCount = 0;

        while ((entry = zis.getNextEntry()) != null) {
            String entryName = entry.getName();
            if (entryName.startsWith("./")) {
                entryName = entryName.substring(2);
            }
            if (entryName.isEmpty()) {
                zis.closeEntry();
                continue;
            }

            File outFile = new File(targetDir, entryName);
            if (entry.isDirectory()) {
                if (!createdDirs.contains(outFile.getAbsolutePath())) {
                    outFile.mkdirs();
                    createdDirs.add(outFile.getAbsolutePath());
                }
            } else {
                File parent = outFile.getParentFile();
                if (parent != null && !createdDirs.contains(parent.getAbsolutePath())) {
                    parent.mkdirs();
                    createdDirs.add(parent.getAbsolutePath());
                }
                try (FileOutputStream fos = new FileOutputStream(outFile);
                     BufferedOutputStream bos = new BufferedOutputStream(fos, 65536)) {
                    int len;
                    while ((len = zis.read(buffer)) > 0) {
                        bos.write(buffer, 0, len);
                    }
                    bos.flush();
                }
                fileCount++;
                if (fileCount % 350 == 0) {
                    currentStatus = "Mengekstrak komponen bot (" + fileCount + " berkas)...";
                }
            }
            zis.closeEntry();
        }
    }

    /**
     * Menghentikan server runner.
     */
    public synchronized void stopServer() {
        isRunning = false;
        if (serverThread != null && serverThread.isAlive()) {
            serverThread.interrupt();
            serverThread = null;
        }
        Log.i(TAG, "Server runner dihentikan.");
    }

    public boolean isRunning() {
        return isRunning;
    }

    /**
     * Memeriksa apakah server lokal di port 3000 sudah siap menerima koneksi HTTP.
     * @return boolean true jika sudah merespon HTTP 200/302
     */
    public static boolean isServerReady() {
        try {
            URL url = new URL(SERVER_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(800);
            conn.setReadTimeout(800);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();
            return (code >= 200 && code < 400);
        } catch (Exception e) {
            return false;
        }
    }
}
