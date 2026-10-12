package expo.modules.alarmengine

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

object AlarmNotificationHelper {
    const val CHANNEL_MEDICINES = "medicines"
    const val CHANNEL_APPOINTMENTS = "appointments"
    const val CHANNEL_ROUTINE = "routine"
    const val CHANNEL_EXERCISE = "exercise"
    const val CHANNEL_WATER_MEALS = "water_meals"
    const val CHANNEL_HABITS = "habits"
    const val CHANNEL_SUMMARIES = "summaries"

    const val ACTION_TAKEN = "expo.modules.alarmengine.ACTION_TAKEN"
    const val ACTION_SNOOZE = "expo.modules.alarmengine.ACTION_SNOOZE"
    const val ACTION_SKIP = "expo.modules.alarmengine.ACTION_SKIP"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val defaultAlarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val audioAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build()

        // 1. Medicines (Max / High importance)
        val medChannel = NotificationChannel(
            CHANNEL_MEDICINES,
            "Medicines & Prescriptions",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Critical medicine reminders and dose schedules"
            enableLights(true)
            lightColor = Color.RED
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 1000)
            setSound(defaultAlarmSound, audioAttributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            setBypassDnd(true)
        }

        // 2. Appointments
        val apptChannel = NotificationChannel(
            CHANNEL_APPOINTMENTS,
            "Appointments & Visits",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Doctor visits, clinic appointments, and lab tests"
            enableLights(true)
            lightColor = Color.BLUE
            enableVibration(true)
            setSound(defaultAlarmSound, audioAttributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }

        // 3. Routine
        val routineChannel = NotificationChannel(
            CHANNEL_ROUTINE,
            "Daily Routine",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Wake up, sleep, wind-down, and routine milestones"
            enableVibration(true)
            setSound(defaultAlarmSound, audioAttributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }

        // 4. Exercise
        val defaultNotifSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notifAudioAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()

        val exerciseChannel = NotificationChannel(
            CHANNEL_EXERCISE,
            "Exercise & Fitness",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Workouts, yoga, meditation, and physical activity"
            enableVibration(true)
            setSound(defaultNotifSound, notifAudioAttributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }

        // 5. Water & Meals
        val waterMealsChannel = NotificationChannel(
            CHANNEL_WATER_MEALS,
            "Water & Meals",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Hydration intervals and meal timing"
            enableVibration(true)
            setSound(defaultNotifSound, notifAudioAttributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }

        // 6. Habits
        val habitsChannel = NotificationChannel(
            CHANNEL_HABITS,
            "Daily Habits",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Habit check-ins and streaks"
            enableVibration(true)
            setSound(defaultNotifSound, notifAudioAttributes)
        }

        // 7. Summaries
        val summaryChannel = NotificationChannel(
            CHANNEL_SUMMARIES,
            "Summaries & Reports",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Weekly insights and health summaries"
        }

        manager.createNotificationChannels(
            listOf(
                medChannel,
                apptChannel,
                routineChannel,
                exerciseChannel,
                waterMealsChannel,
                habitsChannel,
                summaryChannel
            )
        )
    }

    /**
     * Resolves the sound URI configured for this channel in Android system settings.
     * If the user customized the tone in system settings, channel.sound returns their selected URI.
     * Otherwise falls back to system default alarm or notification tone.
     */
    fun getChannelSoundUri(context: Context, channelId: String): android.net.Uri {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val channel = manager?.getNotificationChannel(channelId)
            val soundUri = channel?.sound
            if (soundUri != null && soundUri.toString().isNotEmpty()) {
                return soundUri
            }
        }
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    }

    /**
     * Returns metadata of all LifeTrack notification channels for UI inspection
     * and direct deep-linking to system settings.
     */
    fun getChannelsInfo(context: Context): List<Map<String, Any>> {
        createChannels(context)
        val list = mutableListOf<Map<String, Any>>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val channels = manager?.notificationChannels ?: emptyList()
            for (ch in channels) {
                val soundUri = ch.sound?.toString() ?: "Default System Sound"
                list.add(
                    mapOf(
                        "id" to ch.id,
                        "name" to ch.name.toString(),
                        "description" to (ch.description ?: ""),
                        "importance" to ch.importance,
                        "soundUri" to soundUri,
                        "hasCustomSound" to (ch.sound != null)
                    )
                )
            }
        }
        return list
    }

    fun buildAlarmNotification(
        context: Context,
        alarm: NativeAlarm,
        silent: Boolean = false,
        notificationId: Int = alarm.id.hashCode()
    ): NotificationCompat.Builder {
        createChannels(context)

        val channelId = if (alarm.channelId.isNotEmpty()) alarm.channelId else CHANNEL_MEDICINES

        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Tapping the notification (or the full-screen intent) opens the lock-screen alarm UI.
        // It reads the alarm details from AlarmStorage by id.
        val fullScreenIntent = Intent(context, AlarmFullScreenActivity::class.java).apply {
            putExtra("ALARM_ID", alarm.id)
            setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            fullScreenIntent,
            pendingFlags
        )

        fun actionIntent(action: String, requestOffset: Int): PendingIntent {
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                this.action = action
                putExtra("ALARM_ID", alarm.id)
                putExtra("NOTIFICATION_ID", notificationId)
                putExtra("SNOOZE_MINUTES", alarm.snoozeIntervalMinutes)
            }
            return PendingIntent.getBroadcast(context, notificationId + requestOffset, intent, pendingFlags)
        }

        val takenLabel = alarm.label("taken", "Taken / Done")
        val snoozeLabel = alarm.label("snooze", "Snooze ${alarm.snoozeIntervalMinutes}m")
        val skipLabel = alarm.label("skip", "Skip")

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(alarm.title)
            .setContentText(alarm.message)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(!alarm.isFullAlarm)
            .setOngoing(alarm.isFullAlarm)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(android.R.drawable.ic_menu_agenda, takenLabel, actionIntent(ACTION_TAKEN, 1))
            .addAction(android.R.drawable.ic_popup_reminder, snoozeLabel, actionIntent(ACTION_SNOOZE, 2))
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, skipLabel, actionIntent(ACTION_SKIP, 3))

        if (silent) {
            builder.setSilent(true).setOnlyAlertOnce(true)
        }

        if (alarm.isFullAlarm) {
            builder.setFullScreenIntent(fullScreenPendingIntent, true)
        }

        return builder
    }

    /** Android 14+ lets users (and Play policy) revoke full-screen intents. */
    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            return manager?.canUseFullScreenIntent() ?: false
        }
        return true
    }
}
