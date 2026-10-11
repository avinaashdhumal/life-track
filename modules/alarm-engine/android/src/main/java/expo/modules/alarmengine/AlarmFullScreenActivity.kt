package expo.modules.alarmengine

import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class AlarmFullScreenActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var alarmId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ensure display turns on and displays over keyguard/lockscreen
        setupLockscreenFlags()

        alarmId = intent.getStringExtra("ALARM_ID") ?: ""
        val title = intent.getStringExtra("ALARM_TITLE") ?: "LifeTrack Reminder"
        val message = intent.getStringExtra("ALARM_MESSAGE") ?: "Time for your scheduled reminder."
        val channelId = intent.getStringExtra("ALARM_CHANNEL") ?: AlarmNotificationHelper.CHANNEL_MEDICINES
        val isFull = intent.getBooleanExtra("ALARM_IS_FULL", true)

        if (isFull) {
            startAlarmSoundAndVibration(channelId)
        }

        // Programmatic UI layout so no external layout XML is needed
        val rootView = createFullScreenUI(title, message)
        setContentView(rootView)

        // Log that the full screen alarm was opened
        AlarmStorage.logEvent(this, alarmId, "FULL_SCREEN_SHOWN", System.currentTimeMillis())
    }

    private fun setupLockscreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun startAlarmSoundAndVibration(channelId: String) {
        try {
            val alertUri: Uri = AlarmNotificationHelper.getChannelSoundUri(this, channelId)

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alertUri)
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

    private fun stopSoundAndVibration() {
        AlarmForegroundService.stopAlarm(this)
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createFullScreenUI(titleText: String, messageText: String): View {
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#1C1B1F")) // Material 3 Dark Surface
            gravity = android.view.Gravity.CENTER
            setPadding(48, 80, 48, 80)
        }

        // Subtitle / App badge
        val badge = TextView(this).apply {
            text = "LIFETRACK ALARM"
            setTextColor(android.graphics.Color.parseColor("#D0BCFF")) // PrimaryContainer / accent
            textSize = 14f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }
        layout.addView(badge)

        // Pulsing Alarm Icon
        val iconText = TextView(this).apply {
            text = "⏰"
            textSize = 64f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 16, 0, 32)
        }
        layout.addView(iconText)

        // Alarm Title
        val titleView = TextView(this).apply {
            text = titleText
            setTextColor(android.graphics.Color.WHITE)
            textSize = 28f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        layout.addView(titleView)

        // Alarm Message
        val messageView = TextView(this).apply {
            text = messageText
            setTextColor(android.graphics.Color.parseColor("#CAC4D0"))
            textSize = 18f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 64)
        }
        layout.addView(messageView)

        // Button: Taken / Done
        val takenBtn = Button(this).apply {
            text = "✓ Taken / Done"
            setBackgroundColor(android.graphics.Color.parseColor("#388E3C")) // Forest Green
            setTextColor(android.graphics.Color.WHITE)
            textSize = 18f
            setPadding(32, 24, 32, 24)
            setOnClickListener {
                stopSoundAndVibration()
                AlarmStorage.logEvent(this@AlarmFullScreenActivity, alarmId, "TAKEN", System.currentTimeMillis())
                AlarmStorage.removeAlarm(this@AlarmFullScreenActivity, alarmId)
                dismissNotification()
                finish()
            }
        }
        val btnParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 0, 0, 24)
        }
        layout.addView(takenBtn, btnParams)

        // Button: Snooze (10 min)
        val snoozeBtn = Button(this).apply {
            text = "Snooze 10 Minutes"
            setBackgroundColor(android.graphics.Color.parseColor("#E65100")) // Amber / Orange
            setTextColor(android.graphics.Color.WHITE)
            textSize = 16f
            setPadding(32, 20, 32, 20)
            setOnClickListener {
                stopSoundAndVibration()
                val snoozeTime = System.currentTimeMillis() + 10 * 60 * 1000
                AlarmStorage.logEvent(this@AlarmFullScreenActivity, alarmId, "SNOOZED_10M", System.currentTimeMillis())
                // Reschedule for 10 minutes ahead
                val snoozedAlarm = NativeAlarm(
                    id = "$alarmId-snooze",
                    triggerTimeMs = snoozeTime,
                    title = "$titleText (Snoozed)",
                    message = messageText,
                    channelId = AlarmNotificationHelper.CHANNEL_MEDICINES,
                    isFullAlarm = true
                )
                AlarmSchedulerHelper.scheduleExact(this@AlarmFullScreenActivity, snoozedAlarm)
                dismissNotification()
                finish()
            }
        }
        layout.addView(snoozeBtn, btnParams)

        // Button: Dismiss / Skip
        val dismissBtn = Button(this).apply {
            text = "Dismiss / Skip"
            setBackgroundColor(android.graphics.Color.parseColor("#49454F")) // Surface Variant
            setTextColor(android.graphics.Color.parseColor("#E6E1E5"))
            textSize = 16f
            setPadding(32, 20, 32, 20)
            setOnClickListener {
                stopSoundAndVibration()
                AlarmStorage.logEvent(this@AlarmFullScreenActivity, alarmId, "DISMISSED", System.currentTimeMillis())
                dismissNotification()
                finish()
            }
        }
        layout.addView(dismissBtn, btnParams)

        return layout
    }

    private fun dismissNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.cancel(alarmId.hashCode())
    }

    override fun onDestroy() {
        super.onDestroy()
        stopSoundAndVibration()
    }
}
