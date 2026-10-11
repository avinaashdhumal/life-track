package expo.modules.alarmengine

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat

class AlarmForegroundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var activeAlarmId: String = ""

    companion object {
        const val ACTION_START_ALARM = "expo.modules.alarmengine.START_ALARM_SERVICE"
        const val ACTION_STOP_ALARM = "expo.modules.alarmengine.STOP_ALARM_SERVICE"

        fun startAlarm(context: Context, alarm: NativeAlarm) {
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_START_ALARM
                putExtra("ALARM_ID", alarm.id)
                putExtra("ALARM_TITLE", alarm.title)
                putExtra("ALARM_MESSAGE", alarm.message)
                putExtra("ALARM_CHANNEL", alarm.channelId)
                putExtra("ALARM_IS_FULL", alarm.isFullAlarm)
                putExtra("ALARM_SNOOZE", alarm.snoozeIntervalMinutes)
                putExtra("ALARM_PAYLOAD", alarm.payloadJson)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stopAlarm(context: Context) {
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_STOP_ALARM
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_START_ALARM -> {
                handleStartAlarm(intent)
            }
            ACTION_STOP_ALARM -> {
                handleStopAlarm()
            }
        }

        return START_NOT_STICKY
    }

    private fun handleStartAlarm(intent: Intent) {
        activeAlarmId = intent.getStringExtra("ALARM_ID") ?: ""
        val title = intent.getStringExtra("ALARM_TITLE") ?: "LifeTrack Reminder"
        val message = intent.getStringExtra("ALARM_MESSAGE") ?: "Scheduled alarm active"
        val channelId = intent.getStringExtra("ALARM_CHANNEL") ?: AlarmNotificationHelper.CHANNEL_MEDICINES
        val isFullAlarm = intent.getBooleanExtra("ALARM_IS_FULL", true)
        val snoozeIntervalMinutes = intent.getIntExtra("ALARM_SNOOZE", 10)
        val payloadJson = intent.getStringExtra("ALARM_PAYLOAD") ?: "{}"

        val alarm = NativeAlarm(
            id = activeAlarmId,
            triggerTimeMs = System.currentTimeMillis(),
            title = title,
            message = message,
            channelId = channelId,
            isFullAlarm = isFullAlarm,
            snoozeIntervalMinutes = snoozeIntervalMinutes,
            payloadJson = payloadJson
        )

        // Acquire WakeLock to keep device awake while ringing
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "LifeTrack:ForegroundAlarmWakeLock"
            )
            wakeLock?.acquire(120_000) // 2 minutes max ring timeout
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Build notification and start foreground
        val notifBuilder = AlarmNotificationHelper.buildAlarmNotification(this, alarm)
        val notifId = activeAlarmId.hashCode()
        startForeground(notifId, notifBuilder.build())

        // Start playing the channel's custom tone or system alarm tone
        if (isFullAlarm) {
            startAudioPlayback(channelId)
            startVibration()
        }
    }

    private fun startAudioPlayback(channelId: String) {
        try {
            stopAudioPlayback()

            // Resolve sound URI selected by user for this channel (or fallback to default alarm tone)
            val soundUri: Uri = AlarmNotificationHelper.getChannelSoundUri(this, channelId)

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, soundUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startVibration() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            val pattern = longArrayOf(0, 800, 400, 800, 400, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAudioPlayback() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopVibration() {
        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun handleStopAlarm() {
        stopAudioPlayback()
        stopVibration()

        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        handleStopAlarm()
    }
}
