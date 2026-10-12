package com.wabot.assistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * BootReceiver
 * Menyalakan BotForegroundService secara otomatis saat HP selesai melakukan restart / reboot.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "WABotBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.i(TAG, "Terdeteksi HP baru saja menyala (BOOT_COMPLETED). Menjalankan BotForegroundService...");

            Intent serviceIntent = new Intent(context, BotForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
