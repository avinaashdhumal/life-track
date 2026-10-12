package expo.modules.alarmengine

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Lock-screen alarm UI. It makes no sound itself: AlarmForegroundService owns ringing, so the tone
 * never plays twice and opening this screen from the status-bar alarm-clock icon doesn't ring.
 * Every button goes through AlarmActionHandler, the same path as the notification actions.
 */
class AlarmFullScreenActivity : AppCompatActivity() {

    private var alarmId: String = ""
    private var receiverRegistered = false

    private val closeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val closedId = intent?.getStringExtra("ALARM_ID") ?: return
            if (closedId == alarmId) finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupLockscreenFlags()

        ContextCompat.registerReceiver(
            this,
            closeReceiver,
            IntentFilter(AlarmActionHandler.ACTION_ALARM_CLOSED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        receiverRegistered = true

        render(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        render(intent)
    }

    private fun render(intent: Intent?) {
        alarmId = intent?.getStringExtra("ALARM_ID") ?: ""
        val alarm = AlarmActionHandler.resolveAlarm(this, alarmId)
        if (alarm == null) {
            // Already handled (e.g. from the notification) or unknown: nothing to show.
            finish()
            return
        }
        setContentView(createFullScreenUI(alarm))
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

    private fun act(action: String) {
        AlarmActionHandler.handle(this, alarmId, action)
        finish()
    }

    private fun createFullScreenUI(alarm: NativeAlarm): View {
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#1C1B1F")) // Material 3 Dark Surface
            gravity = android.view.Gravity.CENTER
            setPadding(48, 80, 48, 80)
        }

        layout.addView(TextView(this).apply {
            text = alarm.label("badge", "LIFETRACK ALARM")
            setTextColor(android.graphics.Color.parseColor("#D0BCFF"))
            textSize = 14f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 24)
        })

        layout.addView(TextView(this).apply {
            text = "⏰"
            textSize = 64f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 16, 0, 32)
        })

        layout.addView(TextView(this).apply {
            text = alarm.title
            setTextColor(android.graphics.Color.WHITE)
            textSize = 28f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 16)
        })

        layout.addView(TextView(this).apply {
            text = alarm.message
            setTextColor(android.graphics.Color.parseColor("#CAC4D0"))
            textSize = 18f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 64)
        })

        val btnParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 0, 0, 24)
        }

        layout.addView(Button(this).apply {
            text = "✓ " + alarm.label("taken", "Taken / Done")
            setBackgroundColor(android.graphics.Color.parseColor("#388E3C"))
            setTextColor(android.graphics.Color.WHITE)
            textSize = 18f
            setPadding(32, 24, 32, 24)
            setOnClickListener { act(AlarmActionHandler.TAKEN) }
        }, btnParams)

        layout.addView(Button(this).apply {
            text = alarm.label("snooze", "Snooze ${alarm.snoozeIntervalMinutes}m")
            setBackgroundColor(android.graphics.Color.parseColor("#E65100"))
            setTextColor(android.graphics.Color.WHITE)
            textSize = 16f
            setPadding(32, 20, 32, 20)
            setOnClickListener { act(AlarmActionHandler.SNOOZED) }
        }, btnParams)

        layout.addView(Button(this).apply {
            text = alarm.label("skip", "Skip")
            setBackgroundColor(android.graphics.Color.parseColor("#49454F"))
            setTextColor(android.graphics.Color.parseColor("#E6E1E5"))
            textSize = 16f
            setPadding(32, 20, 32, 20)
            setOnClickListener { act(AlarmActionHandler.SKIPPED) }
        }, btnParams)

        return layout
    }

    override fun onDestroy() {
        if (receiverRegistered) {
            try {
                unregisterReceiver(closeReceiver)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            receiverRegistered = false
        }
        super.onDestroy()
    }
}
