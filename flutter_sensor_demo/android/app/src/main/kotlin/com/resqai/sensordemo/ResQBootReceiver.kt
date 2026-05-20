package com.resqai.sensordemo

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import id.flutter.flutter_background_service.BackgroundService
import id.flutter.flutter_background_service.Config

class ResQBootReceiver : BroadcastReceiver() {
    @SuppressLint("WakelockTimeout")
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val isBootAction = action == Intent.ACTION_BOOT_COMPLETED ||
                action == Intent.ACTION_MY_PACKAGE_REPLACED ||
                action == "android.intent.action.QUICKBOOT_POWERON"

        if (!isBootAction) {
            return
        }

        val config = Config(context)
        if (!config.isAutoStartOnBoot) {
            return
        }

        if (BackgroundService.lockStatic == null) {
            BackgroundService.getLock(context).acquire()
        }

        val serviceIntent = Intent(context, BackgroundService::class.java)
        if (config.isForeground) {
            ContextCompat.startForegroundService(context, serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
