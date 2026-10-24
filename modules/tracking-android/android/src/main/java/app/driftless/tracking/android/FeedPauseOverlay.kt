package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R
import app.driftless.tracking.core.CountBadgeMood
import app.driftless.tracking.core.FeedReason

/** Touch interception only over a recognized feed. System navigation always remains available.
 * Back is performed only after the user presses Leave feed, never automatically.
 */
class FeedPauseOverlay(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: ScrollView? = null
    private var summary: TextView? = null
    private var headline: TextView? = null
    private var bubble: TextView? = null
    private var status: TextView? = null
    private var detection: TextView? = null
    private var mascot: BlinkingBrainView? = null
    private var floatAnimation: ValueAnimator? = null
    private var bypass: Button? = null
    private var bypassAction: (() -> Unit)? = null
    val isShowing get() = root != null
    private fun dp(value: Int) = (value * service.resources.displayMetrics.density).toInt()
    private fun rounded(color: String, radius: Int) = GradientDrawable().apply {
        setColor(Color.parseColor(color)); cornerRadius = dp(radius).toFloat()
    }
    private fun text(value: String, size: Float, color: String = "#FFF9ED") = TextView(service).apply {
        text = value; textSize = size; setTextColor(Color.parseColor(color)); gravity = Gravity.CENTER
    }

    fun show(reason: FeedReason, remainingMs: Long, bypassesLeft: Int, bypassMinutes: Int,
             experimental: Boolean, onBypass: () -> Unit) {
        bypassAction = onBypass
        if (root == null) {
            val content = LinearLayout(service).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                setPadding(dp(24), dp(28), dp(24), dp(28))
                setBackgroundColor(Color.parseColor("#0B0B08"))
            }
            status = text("", 12f, "#FFD399").apply {
                letterSpacing = .12f; setTypeface(typeface, Typeface.BOLD)
            }
            content.addView(status)
            bubble = text("", 15f, "#442600").apply {
                setTypeface(typeface, Typeface.BOLD)
                background = rounded("#FFE5AA", 24)
                setPadding(dp(20), dp(12), dp(20), dp(12))
                layoutParams = LinearLayout.LayoutParams(-2, -2).apply {
                    gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(22)
                }
            }
            content.addView(bubble)
            // A small speech-bubble tail points toward the existing mascot artwork.
            content.addView(text("◆", 22f, "#FFE5AA").apply {
                layoutParams = LinearLayout.LayoutParams(dp(28), dp(16)).apply {
                    gravity = Gravity.CENTER_HORIZONTAL; topMargin = -dp(10)
                }
            })
            mascot = BlinkingBrainView(service).apply {
                setImageResource(R.drawable.scrollsnooze_drained)
                setMood(CountBadgeMood.DRAINED)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Your tired brain asking for a break"
                layoutParams = LinearLayout.LayoutParams(dp(208), dp(208)).apply {
                    gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(14); bottomMargin = dp(8)
                }
            }
            content.addView(mascot)
            headline = text("", 30f).apply {
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(4), 0, dp(10))
            }
            content.addView(headline)
            summary = text("", 16f, "#C4B69D").apply {
                background = rounded("#201B16", 18)
                setPadding(dp(16), dp(14), dp(16), dp(14))
                layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(6); bottomMargin = dp(6) }
            }
            content.addView(summary)
            fun button(label: String, primary: Boolean = false, action: () -> Unit): Button = Button(service).apply {
                text = label; isAllCaps = false; minHeight = dp(54); textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(dp(16), dp(12), dp(16), dp(12))
                setTextColor(Color.parseColor(if (primary) "#442600" else "#FFF9ED"))
                background = if (primary) GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(Color.parseColor("#FFE5AA"), Color.parseColor("#FFBB72"))).apply {
                    cornerRadius = dp(28).toFloat()
                } else rounded("#29251D", 28)
                setOnClickListener { action() }
                content.addView(this, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
            }
            button("Leave feed · take a breather", primary = true) {
                service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                // Keep interception until classification confirms the feed was left.
            }
            bypass = button("Bypass") { bypassAction?.invoke() }
            button("Open ScrollSnooze") {
                service.packageManager.getLaunchIntentForPackage(service.packageName)?.let {
                    it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK); service.startActivity(it)
                }
                hide()
            }
            detection = text("", 11f, "#C4B69D").apply { setPadding(0, dp(14), 0, 0) }
            content.addView(detection)
            content.addView(text("Home and Back remain available. Manage pauses in ScrollSnooze or Android Accessibility settings. Media may continue playing underneath.", 11f, "#C4B69D").apply {
                setPadding(dp(4), dp(10), dp(4), 0)
            })
            val view = ScrollView(service).apply { isFillViewport = true; addView(content) }
            val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { title = "ScrollSnooze feed pause" }
            try {
                wm.addView(view, params); root = view
                if (Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()) {
                    floatAnimation = ValueAnimator.ofFloat(0f, -dp(6).toFloat(), 0f).apply {
                        duration = 3200L; repeatCount = ValueAnimator.INFINITE
                        interpolator = AccelerateDecelerateInterpolator()
                        addUpdateListener { mascot?.translationY = it.animatedValue as Float }
                        start()
                    }
                }
            } catch (_: RuntimeException) { hide(); return }
        }
        val time = (remainingMs.coerceAtLeast(0) + 999) / 1000
        status?.text = when (reason) {
            FeedReason.DAILY_VIDEOS -> "✦  DAILY LIMIT REACHED  ✦"
            FeedReason.BREAK -> "✦  A LITTLE RESET  ✦"
            FeedReason.APP_LIMIT -> "✦  APP LIMIT REACHED  ✦"
            FeedReason.SCHEDULE -> "✦  FOCUS MODE  ✦"
        }
        bubble?.text = if (reason == FeedReason.SCHEDULE) "Your offline era starts now." else "Bestie, my brain needs a breather."
        headline?.text = if (reason == FeedReason.SCHEDULE) "Main character. Offline." else "Plot twist: we log off."
        summary?.text = when (reason) {
            FeedReason.DAILY_VIDEOS -> "Today’s video allowance is used.\nReels & Shorts reset on the next local day, unless you use a bypass."
            FeedReason.BREAK -> "Feed break · ${time / 60}:${(time % 60).toString().padStart(2, '0')} left\nYour next side quest is off-screen. Other app screens remain available after leaving the feed."
            FeedReason.APP_LIMIT -> "Your app-minute limit is reached.\nOnly the recognized short-video feed is paused."
            FeedReason.SCHEDULE -> "You made time for an offline moment.\nYour focus schedule is pausing the short-video feed."
        }
        detection?.text = if (experimental) "Local feed detection is enabled." else ""
        detection?.visibility = if (experimental) android.view.View.VISIBLE else android.view.View.GONE
        bypass?.apply {
            text = if (bypassesLeft > 0) "$bypassMinutes more minutes · $bypassesLeft bypasses left today" else "All daily bypasses used · you’ve got this"
            isEnabled = bypassesLeft > 0
            alpha = if (isEnabled) 1f else .55f
        }
    }

    fun hide() {
        floatAnimation?.cancel(); floatAnimation = null
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root = null; summary = null; bypass = null; bypassAction = null
        headline = null; bubble = null; status = null; detection = null; mascot = null
    }
}
