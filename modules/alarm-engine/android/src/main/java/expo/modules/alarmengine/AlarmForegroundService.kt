package expo.modules.alarmengine

import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat

/**
 * The only component that makes noise for a full alarm: looping tone, vibration (if enabled), and
 * an auto-dismiss timer. AlarmFullScreenActivity is UI only.
 */
class AlarmForegroundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var activeAlarmId: String = ""
    private val handler = Handler(Looper.getMainLooper())
    private var autoDismissRunnable: Runnable? = null

    companion object {
        const val ACTION_START_ALARM = "expo.modules.alarmengine.START_ALARM_SERVICE"
        const val ACTION_STOP_ALARM = "expo.modules.alarmengine.STOP_ALARM_SERVICE"

        fun startAlarm(context: Context, alarm: NativeAlarm) {
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_START_ALARM
                putExtra("ALARM_JSON", alarm.toJson().toString())
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
                val alarm = NativeAlarm.fromJsonString(intent.getStringExtra("ALARM_JSON"))
                if (alarm != null) {
                    handleStartAlarm(alarm)
                } else {
                    stopSelf()
                }
            }
            ACTION_STOP_ALARM -> handleStopAlarm()
        }

        return START_NOT_STICKY
    }

    private fun handleStartAlarm(alarm: NativeAlarm) {
        activeAlarmId = alarm.id
        val ringMinutes = if (alarm.autoDismissMinutes > 0) alarm.autoDismissMinutes else 10

        // Keep the CPU awake while ringing (released on stop or after the ring window)
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "LifeTrack:ForegroundAlarmWakeLock"
            )
            wakeLock?.acquire(ringMinutes * 60_000L + 30_000L)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val notifBuilder = AlarmNotificationHelper.buildAlarmNotification(this, alarm)
        startForeground(alarm.id.hashCode(), notifBuilder.build())

        if (alarm.isFullAlarm) {
            startAudioPlayback(alarm.channelId)
            if (alarm.vibrate) {
                startVibration()
            } else {
                stopVibration()
            }
        }

        // Auto-dismiss: stop ringing and record the reminder as missed (it stays in the shade).
        autoDismissRunnable?.let { handler.removeCallbacks(it) }
        if (alarm.autoDismissMinutes > 0) {
            val alarmId = alarm.id
            val runnable = Runnable {
                if (activeAlarmId == alarmId) {
                    AlarmActionHandler.handle(applicationContext, alarmId, AlarmActionHandler.MISSED)
                }
            }
            autoDismissRunnable = runnable
            handler.postDelayed(runnable, alarm.autoDismissMinutes * 60_000L)
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
            stopVibration()
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
        } catch (e: Exception) {
            e.printStackTrace()
        }
        mediaPlayer = null
    }

    private fun stopVibration() {
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        vibrator = null
    }

    private fun handleStopAlarm() {
        autoDismissRunnable?.let { handler.removeCallbacks(it) }
        autoDismissRunnable = null
        activeAlarmId = ""
        stopAudioPlayback()
        stopVibration()

        try {
            wakeLock?.let { if (it.isHeld) it.release() }
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
        autoDismissRunnable?.let { handler.removeCallbacks(it) }
        stopAudioPlayback()
        stopVibration()
        wakeLock?.let { if (it.isHeld) it.release() }
    }
}
