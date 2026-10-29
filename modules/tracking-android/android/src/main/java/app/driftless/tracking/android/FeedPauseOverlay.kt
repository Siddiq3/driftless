package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import app.driftless.tracking.core.FeedReason

/** Intercepts a recognized feed only. Leave feed invokes Back exclusively after an explicit tap. */
class FeedPauseOverlay(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: PauseSurface? = null
    private var summary: TextView? = null
    private var detection: TextView? = null
    private var bypass: Button? = null
    private var bypassAction: (() -> Unit)? = null
    val isShowing get() = root != null

    fun show(reason: FeedReason, remainingMs: Long, bypassesLeft: Int, bypassMinutes: Int,
             experimental: Boolean, onBypass: () -> Unit) {
        bypassAction = onBypass
        if (root == null) {
            val view = PauseSurface(service)
            summary = view.summary
            detection = view.detection
            view.action("Leave feed", primary = true) {
                service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                // Keep interception until classification confirms that the feed was left.
            }
            bypass = view.action("Bypass") { bypassAction?.invoke() }
            view.action("Open ScrollSnooze") {
                service.packageManager.getLaunchIntentForPackage(service.packageName)?.let {
                    it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    service.startActivity(it)
                }
                hide()
            }
            val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply {
                title = "ScrollSnooze feed pause"
            }
            try {
                wm.addView(view, params)
                root = view
            } catch (_: RuntimeException) { hide(); return }
        }
        val time = (remainingMs.coerceAtLeast(0) + 999) / 1000
        val state = when (reason) {
            FeedReason.DAILY_VIDEOS -> "Daily video limit reached"
            FeedReason.BREAK -> "A moment to reset"
            FeedReason.APP_LIMIT -> "App limit reached"
            FeedReason.SCHEDULE -> "Focus time"
        }
        val title = when (reason) {
            FeedReason.BREAK -> "Breathe. You’re here."
            FeedReason.SCHEDULE -> "Your offline moment."
            else -> "Less feed. More you."
        }
        val body = when (reason) {
            FeedReason.BREAK -> "${time / 60}:${(time % 60).toString().padStart(2, '0')} left in your feed break.\nA little space before the next scroll."
            FeedReason.DAILY_VIDEOS -> "You’ve reached your video goal today. The rest of your day is still yours."
            FeedReason.APP_LIMIT -> "You’ve reached your app-minute limit. Only the short-video feed is paused."
            FeedReason.SCHEDULE -> "You set this time aside. The feed can wait."
        }
        val details = when (reason) {
            FeedReason.DAILY_VIDEOS -> "Your video allowance resets on the next local day, unless you use a bypass."
            FeedReason.BREAK -> "This break resumes after its countdown. Time away still counts. Other app screens remain available after leaving the feed."
            FeedReason.APP_LIMIT -> "Only the recognized short-video feed is paused. Other screens remain available after leaving the feed."
            FeedReason.SCHEDULE -> "Your focus schedule is pausing the short-video feed. Other screens remain available after leaving the feed."
        }
        root?.present(state, title, body, "$details Home and Back remain available. Manage pauses in ScrollSnooze or Android Accessibility settings. Media may continue playing underneath.")
        detection?.apply {
            text = if (experimental) "Beta · local feed detection" else ""
            visibility = if (experimental) View.VISIBLE else View.GONE
        }
        bypass?.apply {
            text = if (bypassesLeft > 0) "$bypassMinutes more minutes · $bypassesLeft left today" else "No bypasses left today"
            isEnabled = bypassesLeft > 0
            alpha = if (isEnabled) 1f else .5f
        }
    }

    fun hide() {
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root = null
        summary = null
        detection = null
        bypass = null
        bypassAction = null
    }
}
