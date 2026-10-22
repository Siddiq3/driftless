package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.app.AlertDialog
import android.content.Intent
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.HapticFeedbackConstants
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.animation.AccelerateDecelerateInterpolator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.view.WindowInsets
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import app.driftless.tracking.R
import app.driftless.tracking.core.CountBadgeValue
import app.driftless.tracking.core.CountBadgeMood

/** Movable service-owned overlay; only its small window receives touches. */
class FloatingCountBadge(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private val prefs = TrackingPrefs(service)
    private var params: WindowManager.LayoutParams? = null
    private var pauseDialog: AlertDialog? = null
    private var dismissTarget: TextView? = null
    private var dismissParams: WindowManager.LayoutParams? = null
    private var overDismissTarget = false
    private var iconSize = 0
    private var root: LinearLayout? = null
    private var face: BlinkingBrainView? = null
    private var mood: CountBadgeMood? = null
    private var idle: ObjectAnimator? = null
    private var count: TextView? = null
    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()
    private fun shape(color: String, radius: Int) = GradientDrawable().apply {
        setColor(Color.parseColor(color)); cornerRadius = dp(radius).toFloat()
    }
    private fun availableSize(): Pair<Int, Int> {
        if (Build.VERSION.SDK_INT >= 30) {
            val metrics = wm.currentWindowMetrics
            val insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            return (metrics.bounds.width() - insets.left - insets.right) to
                (metrics.bounds.height() - insets.top - insets.bottom)
        }
        @Suppress("DEPRECATION")
        val rect = android.graphics.Point().also { wm.defaultDisplay.getSize(it) }
        return rect.x to rect.y
    }
    private fun place(saved: Boolean = true) {
        val view = root ?: return
        val lp = params ?: return
        val (width, height) = availableSize()
        val maxX = (width - view.width).coerceAtLeast(0)
        val maxY = (height - view.height).coerceAtLeast(0)
        lp.x = (if (saved) (prefs.badgeX * maxX).toInt() else lp.x).coerceIn(0, maxX)
        lp.y = (if (saved) (prefs.badgeY * maxY).toInt() else lp.y).coerceIn(0, maxY)
        runCatching { wm.updateViewLayout(view, lp) }
    }
    private fun savePosition() {
        val view = root ?: return
        val lp = params ?: return
        val (width, height) = availableSize()
        prefs.badgeX = lp.x.toFloat() / (width - view.width).coerceAtLeast(1)
        prefs.badgeY = lp.y.toFloat() / (height - view.height).coerceAtLeast(1)
    }
    private fun askPause() {
        if (pauseDialog != null) return
        val dialog = AlertDialog.Builder(service)
            .setTitle("Pause floating counter?")
            .setMessage("Hide the popup. Your videos will still be counted.")
            .setPositiveButton("1 hour") { _, _ -> pause(60 * 60 * 1000L) }
            .setNeutralButton("1 day") { _, _ -> pause(24 * 60 * 60 * 1000L) }
            .setNegativeButton("Cancel", null)
            .create()
        dialog.window?.apply {
            setType(WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY)
            addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)
        }
        dialog.setOnDismissListener { pauseDialog = null }
        pauseDialog = dialog
        try { dialog.show() } catch (_: RuntimeException) { pauseDialog = null }
    }
    private fun pause(duration: Long) {
        prefs.floatingCountPausedUntil = System.currentTimeMillis() + duration
        hide()
        DriftlessAccessibilityService.current?.refreshFloatingCount()
    }
    private fun showDismissTarget() {
        if (dismissTarget != null) return
        val (width, height) = availableSize()
        val target = TextView(service).apply {
            text = "×"; textSize = 36f; gravity = Gravity.CENTER
            setTextColor(Color.WHITE); background = shape("#321B19", 48)
            contentDescription = "Drop here to pause the floating counter"
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val lp = WindowManager.LayoutParams(dp(96), dp(96),
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            x = (width - dp(96)) / 2; y = (height - dp(112)).coerceAtLeast(0)
            title = "ScrollSnooze drag to pause"
        }
        try {
            wm.addView(target, lp); dismissTarget = target; dismissParams = lp
        } catch (_: RuntimeException) { }
    }
    private fun updateDismissTarget() {
        val target = dismissTarget ?: return
        val targetLp = dismissParams ?: return
        val badge = root ?: return
        val badgeLp = params ?: return
        val dx = badgeLp.x + badge.width / 2f - (targetLp.x + dp(48))
        val dy = badgeLp.y + badge.height / 2f - (targetLp.y + dp(48))
        val inside = dx * dx + dy * dy <= dp(64).toFloat() * dp(64)
        if (inside != overDismissTarget) {
            overDismissTarget = inside
            target.background = shape(if (inside) "#BA2839" else "#321B19", 48)
            target.contentDescription = if (inside) "Release to pause" else "Drop here to pause the floating counter"
            if (inside) badge.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
    }
    private fun hideDismissTarget() {
        dismissTarget?.let { runCatching { wm.removeViewImmediate(it) } }
        dismissTarget = null; dismissParams = null; overDismissTarget = false
    }
    private fun enableDragging(view: View) {
        view.setOnClickListener {
            runCatching {
                service.packageManager.getLaunchIntentForPackage(service.packageName)?.let { launch ->
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    service.startActivity(launch)
                }
            }
        }
        var dragging = false
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        val detector = GestureDetector(service, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onSingleTapUp(e: MotionEvent): Boolean =
                if (!dragging) view.performClick() else false
            override fun onLongPress(e: MotionEvent) {
                if (root !== view || !view.isAttachedToWindow) return
                dragging = true
                showDismissTarget()
                view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            }
        })
        view.setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                dragging = false
                downX = event.rawX; downY = event.rawY
                startX = params?.x ?: 0; startY = params?.y ?: 0
            }
            detector.onTouchEvent(event)
            when (event.actionMasked) {
                MotionEvent.ACTION_MOVE -> if (dragging) {
                    params?.x = startX + (event.rawX - downX).toInt()
                    params?.y = startY + (event.rawY - downY).toInt()
                    place(false)
                    updateDismissTarget()
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        val dismiss = overDismissTarget
                        hideDismissTarget()
                        if (dismiss) {
                            place() // Keep the previous position if the pause dialog is cancelled.
                            askPause()
                        } else savePosition()
                    }
                    dragging = false
                }
                MotionEvent.ACTION_CANCEL -> {
                    if (dragging) place()
                    dragging = false
                    hideDismissTarget()
                }
            }
            true
        }
    }
    private fun motionEnabled() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    private fun updateFace(next: CountBadgeMood) {
        val image = face ?: return
        image.setMood(next)
        if (mood == next) return
        val changed = mood != null
        mood = next
        idle?.cancel(); image.animate().cancel()
        image.translationY = 0f; image.rotation = 0f; image.scaleX = 1f; image.scaleY = 1f
        image.setImageResource(if (next == CountBadgeMood.DRAINED) R.drawable.scrollsnooze_drained else R.drawable.scrollsnooze_fresh)
        image.alpha = if (next == CountBadgeMood.UNKNOWN) 0.65f else 1f
        if (!motionEnabled() || next == CountBadgeMood.UNKNOWN) return
        if (changed) {
            image.scaleX = 0.85f; image.scaleY = 0.85f
            image.animate().scaleX(1f).scaleY(1f).setDuration(240).start()
        }
        idle = ObjectAnimator.ofFloat(image, View.TRANSLATION_Y, 0f,
            -dp(if (next == CountBadgeMood.DRAINED) 1 else 3).toFloat()).apply {
            duration = if (next == CountBadgeMood.DRAINED) 1800L else 1200L
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator(); start()
        }
    }
    fun show(value: CountBadgeValue) {
        if (root == null) {
            val column = object : LinearLayout(service) {
                override fun onConfigurationChanged(config: android.content.res.Configuration) {
                    super.onConfigurationChanged(config)
                    post { place() }
                }
            }.apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                setPadding(dp(4), dp(4), dp(4), dp(4))
                contentDescription = "Floating counter. Tap to open ScrollSnooze. Long press to move. Drag to the bottom pause target to dismiss."
            }
            val image = BlinkingBrainView(service).apply {
                setImageResource(R.drawable.scrollsnooze_fresh); scaleType = ImageView.ScaleType.FIT_CENTER
                background = shape("#493078", 32); setPadding(dp(6),dp(6),dp(6),dp(6))
            }
            face = image
            iconSize = prefs.floatingCountSize
            column.addView(image, LinearLayout.LayoutParams(dp(iconSize),dp(iconSize)))
            count = TextView(service).apply {
                textSize = 20f; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER; minWidth = dp(56)
                setPadding(dp(8),0,dp(8),0)
                background = shape("#F33446",24).apply { setStroke(dp(2), Color.parseColor("#493078")) }
            }
            column.addView(count, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,LinearLayout.LayoutParams.WRAP_CONTENT).apply {topMargin=-dp(7)})
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.LEFT
                title = "ScrollSnooze live count"
            }
            try {
                wm.addView(column,params); root=column; this.params=params
                enableDragging(column)
                column.addOnLayoutChangeListener { _, l, t, r, b, ol, ot, or, ob ->
                    if (r-l != or-ol || b-t != ob-ot) place()
                }
                column.post { place() }
            } catch (_: RuntimeException) {face=null;count=null;return}
        }
        if (iconSize != prefs.floatingCountSize) {
            iconSize = prefs.floatingCountSize
            face?.layoutParams = LinearLayout.LayoutParams(dp(iconSize), dp(iconSize))
        }
        updateFace(value.mood)
        if (count?.text?.toString() != value.text && count?.text?.isNotEmpty() == true && motionEnabled()) {
            count?.animate()?.cancel()
            count?.translationY = dp(6).toFloat()
            count?.alpha = 0.4f
            count?.scaleX=1.1f; count?.scaleY=1.1f
            count?.animate()?.translationY(0f)?.alpha(1f)?.scaleX(1f)?.scaleY(1f)?.setDuration(180)?.start()
        }
        count?.text=value.text
        count?.minWidth = dp(iconSize)
        count?.textSize = iconSize * 0.38f
        root?.contentDescription = "${value.text} short videos today. ${if (value.mood == CountBadgeMood.DRAINED) "Daily limit reached." else ""} Tap to open ScrollSnooze. Long press to move. Drag to the bottom target to pause."
    }
    fun hide() {
        hideDismissTarget()
        pauseDialog?.dismiss(); pauseDialog = null
        idle?.cancel(); idle=null
        face?.animate()?.cancel(); count?.animate()?.cancel()
        root?.let {runCatching {wm.removeViewImmediate(it)}}
        root=null;params=null;face=null;mood=null;count=null
    }
}
