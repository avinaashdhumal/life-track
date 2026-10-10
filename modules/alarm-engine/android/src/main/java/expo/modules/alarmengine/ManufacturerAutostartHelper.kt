package expo.modules.alarmengine

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

object ManufacturerAutostartHelper {

    fun getManufacturer(): String {
        return Build.MANUFACTURER?.lowercase() ?: "generic"
    }

    fun openAutostartSettings(context: Context): Boolean {
        val manufacturer = getManufacturer()
        val intents = mutableListOf<Intent>()

        when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                    )
                )
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")
                    )
                )
            }
            manufacturer.contains("oppo") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
                    )
                )
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
                    )
                )
            }
            manufacturer.contains("vivo") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
                    )
                )
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                    )
                )
            }
            manufacturer.contains("oneplus") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
                    )
                )
            }
            manufacturer.contains("realme") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
                    )
                )
            }
            manufacturer.contains("samsung") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")
                    )
                )
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.samsung.android.sm", "com.samsung.android.sm.battery.ui.BatteryActivity")
                    )
                )
            }
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                intents.add(
                    Intent().setComponent(
                        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
                    )
                )
            }
        }

        // Generic fallback: Application Details Settings
        intents.add(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
        )

        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (intent.resolveActivity(context.packageManager) != null) {
                    context.startActivity(intent)
                    return true
                }
            } catch (e: Exception) {
                // Try next intent
            }
        }

        return false
    }

    fun openExactAlarmSettings(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                return true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return false
    }

    fun requestIgnoreBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                return true
            } catch (e: Exception) {
                try {
                    val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(fallback)
                    return true
                } catch (ex: Exception) {
                    ex.printStackTrace()
                }
            }
        }
        return false
    }
}
