package com.wabot.assistant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
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

/**
 * MainActivity
 * Antarmuka visual aplikasi Android yang membungkus Web Controller lokal (http://127.0.0.1:3000)
 * ke dalam WebView layar penuh tanpa address bar browser.
 */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "WABotMainActivity";
    private static final int PERMISSION_REQUEST_NOTIFICATIONS = 101;
    private static final String SERVER_URL = "http://127.0.0.1:3000";

    private WebView webView;
    private LinearLayout loadingLayout;
    private TextView loadingSubtext;
    private Button btnRetry;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isServerLoaded = false;
    private boolean hasShownBatteryPrompt = false;

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

        // 2. Minta izin notifikasi jika diperlukan
        requestNotificationPermission();

        // 3. Konfigurasi WebView
        setupWebView();

        // 4. Mulai polling ketersediaan server lokal
        pollAndLoadServer();
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
     * Meminta izin POST_NOTIFICATIONS untuk Android 13 (API 33) ke atas.
     */
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        PERMISSION_REQUEST_NOTIFICATIONS
                );
            }
        }
    }

    /**
     * Menampilkan dialog edukasi izin baterai dengan penjelasan jelas dan instruksi pilihan (Tanpa Pembatasan).
     * Hanya ditampilkan setelah web controller berhasil dimuat agar tidak mengganggu alur inisialisasi.
     */
    @SuppressLint("BatteryLife")
    private void showBatteryOptimizationGuidance() {
        if (hasShownBatteryPrompt || isFinishing()) return;
        hasShownBatteryPrompt = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                new AlertDialog.Builder(this)
                        .setTitle("🔋 Izin Latar Belakang (Bot Aktif 24 Jam)")
                        .setMessage("Agar bot WhatsApp tetap dapat membalas pesan secara otomatis saat layar HP terkunci atau saat Anda membuka aplikasi lain:\n\n"
                                + "👉 Pada menu baterai yang akan terbuka, pilih opsi:\n"
                                + "   • 'Tanpa Pembatasan' (No Restrictions)\n"
                                + "   • atau 'Jangan Optimalkan'\n\n"
                                + "Bot menggunakan koneksi WebSocket hemat daya (baterai hanya ~1-2% per jam).")
                        .setPositiveButton("Buka Pengaturan Baterai", (dialog, which) -> {
                            try {
                                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                                intent.setData(Uri.parse("package:" + getPackageName()));
                                startActivity(intent);
                            } catch (Exception e) {
                                Log.w(TAG, "Gagal membuka settings baterai: " + e.getMessage());
                            }
                        })
                        .setNegativeButton("Nanti Saja", (dialog, which) -> dialog.dismiss())
                        .setCancelable(true)
                        .show();
            }
        }
    }

    /**
     * Mengonfigurasi WebView agar mendukung JavaScript, DOM Storage, dan viewport responsif.
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

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
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
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // Minimalkan aplikasi ke background tanpa mematikan BotForegroundService
            moveTaskToBack(true);
        }
    }
}
