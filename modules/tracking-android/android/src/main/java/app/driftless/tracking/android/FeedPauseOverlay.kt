package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.core.FeedReason

/** Touch interception only over a recognized feed. System navigation always remains available.
 * Back is performed only after the user presses Leave feed, never automatically.
 */
class FeedPauseOverlay(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: ScrollView? = null
    private var summary: TextView? = null
    private var bypass: Button? = null
    private var bypassAction: (() -> Unit)? = null
    val isShowing get() = root != null

    fun show(reason: FeedReason, remainingMs: Long, bypassesLeft: Int, bypassMinutes: Int,
             experimental: Boolean, onBypass: () -> Unit) {
        bypassAction = onBypass
        if (root == null) {
            val content = LinearLayout(service).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                val pad = (24 * resources.displayMetrics.density).toInt()
                setPadding(pad, pad, pad, pad); setBackgroundColor(Color.rgb(16, 16, 43))
            }
            content.addView(TextView(service).apply {
                text = "Take a breath"; textSize = 30f; setTextColor(Color.WHITE)
            })
            summary = TextView(service).apply { textSize = 18f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER }
            content.addView(summary)
            fun button(label: String, action: () -> Unit): Button = Button(service).apply {
                text = label; isAllCaps = false; minHeight = (52 * resources.displayMetrics.density).toInt()
                setOnClickListener { action() }; content.addView(this, LinearLayout.LayoutParams(-1, -2))
            }
            button("Leave feed") {
                service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                // Keep interception until classification confirms the feed was left.
            }
            button("Open ScrollSnooze") {
                service.packageManager.getLaunchIntentForPackage(service.packageName)?.let {
                    it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK); service.startActivity(it)
                }
                hide()
            }
            bypass = button("Bypass") { bypassAction?.invoke() }
            content.addView(TextView(service).apply {
                text = "Home and Back remain available. You can turn pauses off in ScrollSnooze or Android Accessibility settings. Media may continue playing underneath."
                textSize = 13f; setTextColor(Color.LTGRAY)
            })
            val view = ScrollView(service).apply { isFillViewport = true; addView(content) }
            val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { title = "ScrollSnooze feed pause" }
            try { wm.addView(view, params); root = view }
            catch (_: RuntimeException) { summary = null; bypass = null; return }
        }
        val time = (remainingMs.coerceAtLeast(0) + 999) / 1000
        summary?.text = when (reason) {
            FeedReason.DAILY_VIDEOS -> "Your daily video allowance is used. Reels and Shorts resume on the next local day, unless you use a bypass."
            FeedReason.BREAK -> "Feed break: ${time / 60}:${(time % 60).toString().padStart(2, '0')} remaining. Other app screens remain available after leaving the feed."
            FeedReason.APP_LIMIT -> "Your app-minute limit is reached. This pause applies only to the recognized short-video feed."
            FeedReason.SCHEDULE -> "Focus time: the recognized short-video feed is paused."
        } + if (experimental) "\nLocal feed detection is enabled." else ""
        bypass?.apply {
            text = "$bypassMinutes more minutes ($bypassesLeft bypasses left today)"
            isEnabled = bypassesLeft > 0
        }
    }

    fun hide() {
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root = null; summary = null; bypass = null; bypassAction = null
    }
}
