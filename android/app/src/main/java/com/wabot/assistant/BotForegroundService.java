package com.wabot.assistant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * BotForegroundService
 * Menjaga runtime Node.js dan koneksi Baileys WebSocket tetap berjalan di latar belakang (background)
 * dengan persistent notification dan CPU Partial WakeLock agar bot tidak di-kill oleh sistem Android.
 */
public class BotForegroundService extends Service {
    private static final String TAG = "WABotService";
    public static final String CHANNEL_ID = "wabot_foreground_channel";
    public static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;
    private NodeServerRunner nodeServerRunner;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Membuat BotForegroundService...");

        createNotificationChannel();
        acquireWakeLock();

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

    @Override
    public void onDestroy() {
        Log.i(TAG, "Menghentikan BotForegroundService...");

        if (nodeServerRunner != null) {
            nodeServerRunner.stopServer();
        }

        releaseWakeLock();
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
     * Mengambil CPU WakeLock agar bot tetap responsif menerima chat saat layar HP terkunci.
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
}
