package com.wabot.assistant;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * BotForegroundService
 * Menjaga runtime Node.js dan koneksi Baileys WebSocket tetap berjalan 24/7 di latar belakang (background)
 * dengan persistent notification, CPU Partial WakeLock, dan Wi-Fi High-Performance Lock
 * agar bot tidak di-kill oleh sistem Android saat layar HP terkunci (sleep) atau saat membersihkan RAM.
 */
public class BotForegroundService extends Service {
    private static final String TAG = "WABotService";
    public static final String CHANNEL_ID = "wabot_foreground_channel";
    public static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private NodeServerRunner nodeServerRunner;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Membuat BotForegroundService...");

        createNotificationChannel();
        acquireWakeLock();
        acquireWifiLock();

        // Inisialisasi runner server lokal
        nodeServerRunner = new NodeServerRunner(getApplicationContext());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Memulai BotForegroundService di foreground...");

        try {
            Notification notification = buildForegroundNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.w(TAG, "Peringatan startForeground dengan type: " + e.getMessage());
            try {
                startForeground(NOTIFICATION_ID, buildForegroundNotification());
            } catch (Exception e2) {
                Log.e(TAG, "Fallback startForeground gagal: " + e2.getMessage());
            }
        }

        // Jalankan background server thread jika belum aktif
        try {
            if (nodeServerRunner != null && !nodeServerRunner.isRunning()) {
                nodeServerRunner.startServer();
            }
        } catch (Exception e) {
            Log.e(TAG, "Gagal memulai nodeServerRunner: " + e.getMessage(), e);
        }

        // START_STICKY memberitahu Android untuk merestart service jika terbunuh karena kehabisan memori ekstrem
        return START_STICKY;
    }

    /**
     * Dipanggil ketika user melakukan swipe away aplikasi dari recent apps.
     * Mengamankan agar bot tetap hidup dan otomatis menjadwalkan restart jika Android mencoba membunuh proses.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.w(TAG, "Aplikasi di-swipe dari recent apps (onTaskRemoved). Memastikan BotForegroundService tetap aktif...");

        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), BotForegroundService.class);
            restartServiceIntent.setPackage(getPackageName());

            int flags = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent restartServicePendingIntent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                restartServicePendingIntent = PendingIntent.getForegroundService(
                        getApplicationContext(),
                        1002,
                        restartServiceIntent,
                        flags
                );
            } else {
                restartServicePendingIntent = PendingIntent.getService(
                        getApplicationContext(),
                        1002,
                        restartServiceIntent,
                        flags
                );
            }

            AlarmManager alarmManager = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                // Jadwalkan restart darurat 1 detik kemudian yang menembus mode Doze/Sleep (RTC_WAKEUP)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + 1000,
                            restartServicePendingIntent
                    );
                } else {
                    alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + 1000,
                            restartServicePendingIntent
                    );
                }
                Log.i(TAG, "Alarm pemulihan darurat Foreground Service berhasil didaftarkan (RTC_WAKEUP).");
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal menjadwalkan alarm pemulihan service: " + e.getMessage());
        }

        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Menghentikan BotForegroundService...");

        if (nodeServerRunner != null) {
            nodeServerRunner.stopServer();
        }

        releaseWakeLock();
        releaseWifiLock();
        stopForeground(true);

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Membangun notifikasi tetap di notification tray.
     */
    private Notification buildForegroundNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(getString(R.string.notification_text))
                .setSmallIcon(R.drawable.ic_bot_notification)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    /**
     * Membuat Notification Channel untuk Android 8.0 (API 26) ke atas.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription(getString(R.string.notification_channel_desc));
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Mengambil CPU WakeLock agar bot tetap responsif memproses chat saat layar HP terkunci (sleep).
     */
    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WABot::CpuWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
                Log.i(TAG, "CPU WakeLock berhasil diaktifkan.");
            }
        }
    }

    /**
     * Melepas CPU WakeLock.
     */
    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            Log.i(TAG, "CPU WakeLock dilepaskan.");
        }
    }

    /**
     * Mengambil Wi-Fi Lock agar radio Wi-Fi HP tidak masuk mode hemat daya agresif saat layar mati,
     * sehingga koneksi WebSocket WhatsApp ke server Baileys tetap stabil tanpa terputus.
     */
    private void acquireWifiLock() {
        if (wifiLock == null) {
            try {
                WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifiManager != null) {
                    int mode = WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    wifiLock = wifiManager.createWifiLock(mode, "WABot::WifiLock");
                    wifiLock.setReferenceCounted(false);
                    wifiLock.acquire();
                    Log.i(TAG, "Wi-Fi High-Performance Lock berhasil diaktifkan.");
                }
            } catch (Exception e) {
                Log.w(TAG, "Tidak dapat mengaktifkan Wi-Fi Lock: " + e.getMessage());
            }
        }
    }

    /**
     * Melepas Wi-Fi Lock.
     */
    private void releaseWifiLock() {
        if (wifiLock != null && wifiLock.isHeld()) {
            try {
                wifiLock.release();
                wifiLock = null;
                Log.i(TAG, "Wi-Fi Lock dilepaskan.");
            } catch (Exception e) {
                Log.w(TAG, "Gagal melepaskan Wi-Fi Lock: " + e.getMessage());
            }
        }
    }
}
