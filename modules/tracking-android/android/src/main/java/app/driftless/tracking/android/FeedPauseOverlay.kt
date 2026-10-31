package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.view.WindowManager
import android.widget.Button
import app.driftless.tracking.core.FeedReason

/** Intercepts a recognized feed only. Leave feed invokes Back exclusively after an explicit tap. */
class FeedPauseOverlay(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: PauseSurface? = null
    private var bypass: Button? = null
    private var bypassAction: (() -> Unit)? = null
    val isShowing get() = root != null

    fun show(reason: FeedReason, remainingMs: Long, bypassesLeft: Int, bypassMinutes: Int,
             experimental: Boolean, count: Int = 0, onBypass: () -> Unit) {
        bypassAction = onBypass
        if (root == null) {
            val view = PauseSurface(service)
            view.action("Leave feed", primary = true) {
                service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                // Keep interception until classification confirms that the feed was left.
            }
            bypass = view.action("Bypass") { bypassAction?.invoke() }
            view.action("Open ScrollSnooze", quiet = true) {
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
        val clock = "${time / 60}:${(time % 60).toString().padStart(2, '0')}"
        val note = if (experimental) "Detection is experimental. ${PauseSurface.FOOTER}" else PauseSurface.FOOTER
        when (reason) {
            FeedReason.BREAK -> root?.present("Take a breath.", "The feed will still be here after your break.", clock, "left in this break", note)
            FeedReason.DAILY_VIDEOS -> root?.present("That’s your goal.", "The rest of your day is yours. Your count resets tomorrow.", count.toString(), "videos today", note)
            FeedReason.APP_LIMIT -> root?.present("Time’s up for today.", "You reached your daily limit. Only the feed is paused.", note = note)
            FeedReason.SCHEDULE -> root?.present("Focus time.", "You set this time aside. The feed can wait.", note = note)
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
        bypass = null
        bypassAction = null
    }
}
