package expo.modules.alarmengine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject

class ScheduleAlarmOptionsRecord : Record {
    @Field var id: String = ""
    @Field var triggerTimeMs: Long = 0L
    @Field var title: String = "Reminder"
    @Field var message: String = ""
    @Field var channelId: String = AlarmNotificationHelper.CHANNEL_MEDICINES
    @Field var isFullAlarm: Boolean = true
    @Field var snoozeIntervalMinutes: Int = 10
    @Field var payload: Map<String, Any?>? = null
    @Field var repeatEveryDays: Int = 0
    @Field var repeatUntilMs: Long = 0L
    @Field var seriesPrefix: String = ""
    @Field var seriesSuffix: String = ""
    @Field var vibrate: Boolean = true
    @Field var autoDismissMinutes: Int = 5
    @Field var labels: Map<String, String>? = null
    @Field var soundUri: String = ""
    @Field var infoOnly: Boolean = false
}

class AlarmEngineModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React application context is null")

    override fun definition() = ModuleDefinition {
        Name("AlarmEngine")

        OnCreate {
            // Ensure notification channels are set up at module initialization
            AlarmNotificationHelper.createChannels(context)
        }

        AsyncFunction("scheduleAlarm") { options: ScheduleAlarmOptionsRecord ->
            if (options.id.isBlank() || options.triggerTimeMs <= 0L) {
                return@AsyncFunction false
            }
            val payloadJson = options.payload?.let { JSONObject(it).toString() } ?: "{}"
            val labelsJson = options.labels?.let { JSONObject(it).toString() } ?: "{}"

            val alarm = NativeAlarm(
                id = options.id,
                triggerTimeMs = options.triggerTimeMs,
                title = options.title.ifBlank { "Reminder" },
                message = options.message,
                channelId = options.channelId.ifBlank { AlarmNotificationHelper.CHANNEL_MEDICINES },
                isFullAlarm = options.isFullAlarm,
                snoozeIntervalMinutes = options.snoozeIntervalMinutes,
                payloadJson = payloadJson,
                repeatEveryDays = options.repeatEveryDays.coerceAtLeast(0),
                repeatUntilMs = options.repeatUntilMs,
                seriesPrefix = options.seriesPrefix,
                seriesSuffix = options.seriesSuffix,
                vibrate = options.vibrate,
                autoDismissMinutes = options.autoDismissMinutes.coerceAtLeast(0),
                labelsJson = labelsJson,
                soundUri = options.soundUri,
                infoOnly = options.infoOnly
            )

            AlarmSchedulerHelper.scheduleExact(context, alarm)
            return@AsyncFunction true
        }

        AsyncFunction("cancelAlarm") { id: String ->
            AlarmSchedulerHelper.cancel(context, id)
            return@AsyncFunction true
        }

        AsyncFunction("cancelAll") {
            AlarmSchedulerHelper.cancelAll(context)
            return@AsyncFunction true
        }

        AsyncFunction("getScheduledAlarms") { ->
            val alarms = AlarmStorage.getAllAlarms(context)
            alarms.map { alarm ->
                mapOf(
                    "id" to alarm.id,
                    "triggerTimeMs" to alarm.triggerTimeMs,
                    "title" to alarm.title,
                    "message" to alarm.message,
                    "channelId" to alarm.channelId,
                    "isFullAlarm" to alarm.isFullAlarm,
                    "snoozeIntervalMinutes" to alarm.snoozeIntervalMinutes,
                    "payloadJson" to alarm.payloadJson,
                    "repeatEveryDays" to alarm.repeatEveryDays,
                    "soundUri" to alarm.soundUri,
                    "infoOnly" to alarm.infoOnly
                )
            }
        }

        AsyncFunction("getSystemTones") { ->
            ToneHelper.listTones(context)
        }

        AsyncFunction("previewTone") { uri: String ->
            ToneHelper.preview(context, uri)
        }

        AsyncFunction("stopTonePreview") { ->
            ToneHelper.stopPreview()
            true
        }

        AsyncFunction("drainPendingActions") { ->
            AlarmStorage.drainPendingActions(context)
        }

        AsyncFunction("canUseFullScreenIntent") { ->
            AlarmNotificationHelper.canUseFullScreenIntent(context)
        }

        AsyncFunction("openFullScreenIntentSettings") { ->
            try {
                val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
                } else {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                ManufacturerAutostartHelper.openAppNotificationSettings(context)
            }
        }

        AsyncFunction("canScheduleExactAlarms") { ->
            AlarmSchedulerHelper.canScheduleExact(context)
        }

        AsyncFunction("openExactAlarmSettings") { ->
            ManufacturerAutostartHelper.openExactAlarmSettings(context)
        }

        AsyncFunction("isIgnoringBatteryOptimizations") { ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
            } else {
                true
            }
        }

        AsyncFunction("requestIgnoreBatteryOptimizations") { ->
            ManufacturerAutostartHelper.requestIgnoreBatteryOptimizations(context)
        }

        AsyncFunction("getManufacturer") { ->
            ManufacturerAutostartHelper.getManufacturer()
        }

        AsyncFunction("openAutostartSettings") { ->
            ManufacturerAutostartHelper.openAutostartSettings(context)
        }

        AsyncFunction("getLastFiredAlarm") { ->
            val jsonStr = AlarmStorage.getLastFired(context) ?: return@AsyncFunction null
            try {
                val obj = JSONObject(jsonStr)
                val map = mutableMapOf<String, Any>()
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    map[key] = obj.get(key)
                }
                map
            } catch (e: Exception) {
                null
            }
        }

        AsyncFunction("openChannelNotificationSettings") { channelId: String ->
            ManufacturerAutostartHelper.openChannelNotificationSettings(context, channelId)
        }

        AsyncFunction("openAppNotificationSettings") { ->
            ManufacturerAutostartHelper.openAppNotificationSettings(context)
        }

        AsyncFunction("getNotificationChannels") { ->
            AlarmNotificationHelper.getChannelsInfo(context)
        }
    }
}
