package com.wabot.assistant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * MainActivity
 * Antarmuka visual aplikasi Android yang membungkus Web Controller lokal (http://127.0.0.1:3000)
 * ke dalam WebView layar penuh tanpa address bar browser.
 */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "WABotMainActivity";
    private static final int PERMISSION_REQUEST_NOTIFICATIONS = 101;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1002;
    private static final int PERMISSION_REQUEST_INITIAL_SETUP = 1003;
    private static final String PREFS_NAME = "wabot_prefs";
    private static final String KEY_PERMISSIONS_ONBOARDING_DONE = "has_completed_initial_permissions";
    private static final String SERVER_URL = "http://127.0.0.1:3000";

    private WebView webView;
    private LinearLayout loadingLayout;
    private TextView loadingSubtext;
    private Button btnRetry;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isServerLoaded = false;
    private boolean hasShownBatteryPrompt = false;
    private ValueCallback<Uri[]> mFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        loadingLayout = findViewById(R.id.loadingLayout);
        loadingSubtext = findViewById(R.id.loadingSubtext);
        btnRetry = findViewById(R.id.btnRetry);

        webView.setVisibility(View.GONE);
        loadingLayout.setVisibility(View.VISIBLE);

        if (btnRetry != null) {
            btnRetry.setOnClickListener(v -> {
                btnRetry.setVisibility(View.GONE);
                if (loadingSubtext != null) {
                    loadingSubtext.setText("Menghubungkan ulang ke server lokal...");
                }
                startBotService();
                pollAndLoadServer();
            });
        }

        // 1. Jalankan Background Foreground Service dengan penanganan aman
        startBotService();

        // 2. Konfigurasi WebView
        setupWebView();

        // 3. Cek apakah server lokal sudah siap (Instant Load / Zero Reload)
        if (NodeServerRunner.isServerReady()) {
            Log.i(TAG, "Server lokal port 3000 sudah berjalan! Menampilkan WebView secara instan (Zero Reload)...");
            isServerLoaded = true;
            loadingLayout.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            if (savedInstanceState != null) {
                webView.restoreState(savedInstanceState);
            } else {
                webView.loadUrl(SERVER_URL);
            }
        } else {
            webView.setVisibility(View.GONE);
            loadingLayout.setVisibility(View.VISIBLE);
            pollAndLoadServer();
        }

        // 4. Inisialisasi perizinan awal saat pertama kali dibuka (Upfront Permissions Onboarding)
        checkAndRequestInitialPermissions();
    }

    /**
     * Memulai background foreground service bot secara aman.
     */
    private void startBotService() {
        try {
            Intent serviceIntent = new Intent(this, BotForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.i(TAG, "BotForegroundService berhasil dipanggil.");
        } catch (Exception e) {
            Log.e(TAG, "Gagal memulai BotForegroundService: " + e.getMessage(), e);
        }
    }

    /**
     * Memeriksa dan memfasilitasi konfigurasi perizinan penting di awal (Upfront Permissions Onboarding).
     * Muncul saat pengguna pertama kali membuka aplikasi agar seluruh izin esensial
     * (Akses berkas, Notifikasi, Baterai Tanpa Pembatasan, dan Autostart) aktif sejak awal.
     */
    private void checkAndRequestInitialPermissions() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isCompleted = prefs.getBoolean(KEY_PERMISSIONS_ONBOARDING_DONE, false);

        if (!isCompleted) {
            new AlertDialog.Builder(this)
                    .setTitle("🚀 Konfigurasi Perizinan WA Bot Bisnis AI")
                    .setMessage("Agar bot WhatsApp dapat bekerja 24 jam nonstop melayani pelanggan seperti WhatsApp / Instagram saat layar HP mati (sleep), switch app, atau membersihkan RAM, aktifkan perizinan berikut:\n\n"
                            + "1️⃣ Akses Berkas & Foto: Untuk upload foto katalog produk & dokumen bisnis.\n"
                            + "2️⃣ Notifikasi Latar Belakang: Menjaga icon bot tetap aktif di tray atas.\n"
                            + "3️⃣ Baterai Tanpa Pembatasan: Mencegah CPU HP menidurkan bot saat layar mati.\n"
                            + "4️⃣ Mulai Otomatis (Autostart): Mencegah bot terhapus saat membersihkan RAM.\n\n"
                            + "👉 Ketuk tombol di bawah untuk mengonfigurasi dengan mudah (1-Klik):")
                    .setPositiveButton("Konfigurasi Perizinan (1-Klik)", (dialog, which) -> {
                        prefs.edit().putBoolean(KEY_PERMISSIONS_ONBOARDING_DONE, true).apply();
                        requestAllAppPermissions();
                    })
                    .setNegativeButton("Lanjutkan", (dialog, which) -> {
                        prefs.edit().putBoolean(KEY_PERMISSIONS_ONBOARDING_DONE, true).apply();
                        dialog.dismiss();
                    })
                    .setCancelable(false)
                    .show();
        }
    }

    /**
     * Meminta izin runtime Android (Notifikasi + Storage) dan memicu dialog baterai/settings.
     */
    private void requestAllAppPermissions() {
        List<String> permissionsToRequest = new ArrayList<>();

        // Izin Notifikasi (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        // Izin Baca Gambar / Berkas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!permissionsToRequest.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    permissionsToRequest.toArray(new String[0]),
                    PERMISSION_REQUEST_INITIAL_SETUP
            );
        } else {
            // Jika izin runtime sudah ada, langsung arahkan ke optimasi baterai dan settings
            promptBatteryAndAppSettings();
        }
    }

    /**
     * Memicu dialog whitelist sistem pengabaian optimasi baterai dan membuka info aplikasi.
     */
    private void promptBatteryAndAppSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal memicu ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: " + e.getMessage());
                }
            }
        }
        handler.postDelayed(() -> openAppSettings(), 1200);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_INITIAL_SETUP || requestCode == PERMISSION_REQUEST_NOTIFICATIONS) {
            Log.i(TAG, "Hasil perizinan runtime diterima. Melanjutkan ke optimasi baterai & pengaturan...");
            promptBatteryAndAppSettings();
        }
    }

    /**
     * Membuka lokasi pengaturan aplikasi langsung di sistem Android.
     * Mengarahkan user langsung ke layar 'Info Aplikasi' (App Info) di Pengaturan HP,
     * tempat opsi Baterai ('Tidak Dibatasi' / 'Unrestricted') dan Perizinan Aktivitas Latar Belakang berada.
     */
    public void openAppSettings() {
        boolean opened = false;
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            opened = true;
            Log.i(TAG, "Berhasil membuka ACTION_APPLICATION_DETAILS_SETTINGS.");
        } catch (Exception e) {
            Log.w(TAG, "Gagal buka ACTION_APPLICATION_DETAILS_SETTINGS: " + e.getMessage());
        }

        if (!opened) {
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                opened = true;
                Log.i(TAG, "Berhasil membuka ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS.");
            } catch (Exception e) {
                Log.w(TAG, "Gagal buka ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS: " + e.getMessage());
            }
        }
    }

    /**
     * Membuka dialog sistem permintaan izin pengabaian optimasi baterai (1-klik whitelist).
     */
    @SuppressLint("BatteryLife")
    public void requestSystemBatteryDialog() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                Log.i(TAG, "Berhasil memanggil dialog ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.");
            } catch (Exception e) {
                Log.w(TAG, "Gagal buka ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, fallback ke App Settings: " + e.getMessage());
                openAppSettings();
            }
        } else {
            openAppSettings();
        }
    }

    /**
     * Menampilkan dialog edukasi izin latar belakang & optimasi baterai dengan tombol aksi langsung.
     * Mengarahkan pengguna langsung ke layar pengaturan sistem HP dalam 1 klik.
     */
    @SuppressLint("BatteryLife")
    private void showBatteryOptimizationGuidance() {
        if (isFinishing() || hasShownBatteryPrompt) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                hasShownBatteryPrompt = true;
                new AlertDialog.Builder(this)
                        .setTitle("🚀 Agar Bot Aktif 24 Jam Non-Stop")
                        .setMessage("Agar WA Bot Bisnis AI terus melayani pelanggan tanpa henti saat layar HP mati (sleep), saat membuka aplikasi lain, atau saat membersihkan RAM:\n\n"
                                + "👉 Klik tombol di bawah untuk langsung menuju Pengaturan Aplikasi:\n"
                                + "1️⃣ Baterai: Pilih 'Tidak Dibatasi' (Unrestricted) / 'Jangan Optimalkan'.\n"
                                + "2️⃣ Latar Belakang: Izinkan Aktivitas Latar Belakang / Mulai Otomatis (Autostart).\n"
                                + "3️⃣ Disarankan: Kunci / Gembok aplikasi di daftar Recent Apps HP Anda.\n\n"
                                + "💡 Tenang, bot menggunakan koneksi WebSocket hemat daya (baterai hanya ~1-2% per jam) dan aman untuk pemakaian jangka panjang.")
                        .setPositiveButton("Buka Pengaturan (Tinggal Klik)", (dialog, which) -> {
                            openAppSettings();
                        })
                        .setNeutralButton("Izin Whitelist Cepat", (dialog, which) -> {
                            requestSystemBatteryDialog();
                        })
                        .setNegativeButton("Nanti Saja", (dialog, which) -> dialog.dismiss())
                        .setCancelable(true)
                        .show();
            }
        }
    }

    /**
     * Jembatan JavaScript untuk memanggil fungsi native dari antarmuka Web Controller.
     */
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void openBatterySettings() {
            handler.post(() -> openAppSettings());
        }

        @JavascriptInterface
        public void openSystemBatteryDialog() {
            handler.post(() -> requestSystemBatteryDialog());
        }
    }

    /**
     * Membangun Intent pemilih berkas / galeri yang cerdas berdasarkan parameter acceptTypes dari HTML.
     */
    private Intent buildFileChooserIntent(WebChromeClient.FileChooserParams params) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");

        if (params != null && params.getAcceptTypes() != null && params.getAcceptTypes().length > 0) {
            List<String> validMimes = new ArrayList<>();
            boolean onlyImages = true;

            for (String raw : params.getAcceptTypes()) {
                if (raw == null) continue;
                String t = raw.trim().toLowerCase();
                if (t.isEmpty()) continue;

                if (t.equals("image/*") || t.startsWith("image/")) {
                    validMimes.add(t);
                } else if (t.startsWith(".")) {
                    if (t.equals(".jpg") || t.equals(".jpeg")) validMimes.add("image/jpeg");
                    else if (t.equals(".png")) validMimes.add("image/png");
                    else if (t.equals(".webp")) validMimes.add("image/webp");
                    else if (t.equals(".pdf")) { validMimes.add("application/pdf"); onlyImages = false; }
                    else if (t.equals(".txt")) { validMimes.add("text/plain"); onlyImages = false; }
                    else if (t.equals(".json")) { validMimes.add("application/json"); onlyImages = false; }
                    else if (t.equals(".csv")) { validMimes.add("text/csv"); onlyImages = false; }
                    else if (t.equals(".md")) { validMimes.add("text/*"); onlyImages = false; }
                    else { validMimes.add("*/*"); onlyImages = false; }
                } else {
                    validMimes.add(t);
                    if (!t.startsWith("image/")) {
                        onlyImages = false;
                    }
                }
            }

            if (onlyImages && !validMimes.isEmpty()) {
                intent.setType("image/*");
            } else if (validMimes.size() == 1) {
                intent.setType(validMimes.get(0));
            } else if (validMimes.size() > 1) {
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, validMimes.toArray(new String[0]));
            }
        }

        return intent;
    }

    /**
     * Mengonfigurasi WebView agar mendukung JavaScript, DOM Storage, File Chooser (Upload Foto/Dokumen),
     * dan navigasi pengaturan baterai native.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Tambahkan jembatan JavaScript native (AndroidBridge)
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");

        // WebChromeClient dengan dukungan penuh input type="file" (Upload Foto Produk & Dokumen SOP)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                    mFilePathCallback = null;
                }
                mFilePathCallback = filePathCallback;

                Intent intent = buildFileChooserIntent(fileChooserParams);
                Intent chooserIntent = Intent.createChooser(intent, "Pilih Gambar / Berkas");

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    Log.e(TAG, "Tidak ada aplikasi file chooser yang tersedia: " + e.getMessage());
                    if (mFilePathCallback != null) {
                        mFilePathCallback.onReceiveValue(null);
                        mFilePathCallback = null;
                    }
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    String url = request.getUrl().toString();
                    if (url.startsWith("app://open-battery-settings")) {
                        openAppSettings();
                        return true;
                    }
                    if (url.startsWith("app://open-system-battery-dialog")) {
                        requestSystemBatteryDialog();
                        return true;
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null) {
                    if (url.startsWith("app://open-battery-settings")) {
                        openAppSettings();
                        return true;
                    }
                    if (url.startsWith("app://open-system-battery-dialog")) {
                        requestSystemBatteryDialog();
                        return true;
                    }
                }
                return super.shouldOverrideUrlLoading(view, url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && (url.startsWith(SERVER_URL) || url.contains(":3000"))) {
                    isServerLoaded = true;
                    loadingLayout.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);

                    // Tampilkan panduan optimasi baterai dengan sopan setelah halaman pertama berhasil dimuat
                    handler.postDelayed(() -> showBatteryOptimizationGuidance(), 1500);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                // Jika server lokal belum siap, tetap sembunyikan webview dan coba lagi secara halus
                if (!isServerLoaded) {
                    webView.setVisibility(View.GONE);
                    loadingLayout.setVisibility(View.VISIBLE);
                    handler.postDelayed(() -> {
                        if (NodeServerRunner.isServerReady()) {
                            webView.loadUrl(SERVER_URL);
                        }
                    }, 1500);
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            ClipData.Item item = data.getClipData().getItemAt(i);
                            results[i] = item.getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getDataString() != null) {
                        results = new Uri[]{Uri.parse(data.getDataString())};
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        }
    }

    /**
     * Melakukan polling ke server lokal port 3000 hingga siap, lalu memuat URL ke WebView.
     */
    private void pollAndLoadServer() {
        new Thread(() -> {
            int retries = 0;
            while (!isServerLoaded) {
                final String status = NodeServerRunner.getCurrentStatus();
                handler.post(() -> {
                    if (loadingSubtext != null && !isServerLoaded) {
                        loadingSubtext.setText(status);
                    }
                });

                if (NodeServerRunner.isServerReady()) {
                    Log.i(TAG, "Server lokal port 3000 terdeteksi SIAP! Memuat WebView...");
                    handler.post(() -> {
                        if (loadingSubtext != null) {
                            loadingSubtext.setText("Server siap! Menampilkan dashboard...");
                        }
                        webView.loadUrl(SERVER_URL);
                    });
                    break;
                }

                retries++;
                // Jika sudah lebih dari 35 detik, tampilkan tombol retry agar user dapat mencoba ulang kapan saja
                if (retries > 35 && retries % 5 == 0) {
                    handler.post(() -> {
                        if (btnRetry != null && !isServerLoaded) {
                            btnRetry.setVisibility(View.VISIBLE);
                        }
                    });
                }

                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {}
            }
        }).start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (isServerLoaded) {
            handler.postDelayed(() -> showBatteryOptimizationGuidance(), 1000);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        // Jika user membuka kembali aplikasi dari launcher / recent apps (singleTask),
        // langsung tampilkan WebView tanpa reload ulang
        if (isServerLoaded && webView != null) {
            loadingLayout.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        if (webView != null) {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // Minimalkan aplikasi ke background tanpa mematikan BotForegroundService
            moveTaskToBack(true);
        }
    }
}
