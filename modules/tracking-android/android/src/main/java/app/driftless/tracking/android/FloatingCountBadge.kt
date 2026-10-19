package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
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

/** Passive, service-owned accessibility overlay. No touch interception or separate overlay grant. */
class FloatingCountBadge(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: LinearLayout? = null
    private var face: ImageView? = null
    private var mood: CountBadgeMood? = null
    private var idle: ObjectAnimator? = null
    private var count: TextView? = null
    private var status: TextView? = null
    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()
    private fun shape(color: String, radius: Int) = GradientDrawable().apply {
        setColor(Color.parseColor(color)); cornerRadius = dp(radius).toFloat()
    }
    private fun topInset(): Int {
        if (Build.VERSION.SDK_INT >= 30) return wm.currentWindowMetrics.windowInsets
            .getInsetsIgnoringVisibility(WindowInsets.Type.statusBars() or WindowInsets.Type.displayCutout()).top
        val id = service.resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id != 0) service.resources.getDimensionPixelSize(id) else dp(24)
    }
    private fun motionEnabled() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    private fun updateFace(next: CountBadgeMood) {
        val image = face ?: return
        if (mood == next) return
        val changed = mood != null
        mood = next
        idle?.cancel(); image.animate().cancel()
        image.translationY = 0f; image.rotation = 0f; image.scaleX = 1f; image.scaleY = 1f
        image.setImageResource(if (next == CountBadgeMood.DRAINED) R.drawable.brain_tired else R.drawable.brain_wave)
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
            val column = LinearLayout(service).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                setPadding(dp(4), dp(4), dp(4), dp(4))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            }
            val image = ImageView(service).apply {
                setImageResource(R.drawable.brain_wave); scaleType = ImageView.ScaleType.FIT_CENTER
                background = shape("#572421", 32); setPadding(dp(6),dp(6),dp(6),dp(6))
            }
            face = image
            column.addView(image, LinearLayout.LayoutParams(dp(54),dp(54)))
            count = TextView(service).apply {
                textSize = 20f; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER; minWidth = dp(56)
                setPadding(dp(8),0,dp(8),0); background = shape("#BA2839",24)
            }
            column.addView(count, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,LinearLayout.LayoutParams.WRAP_CONTENT).apply {topMargin=-dp(7)})
            status = TextView(service).apply {
                textSize = 9f; setTextColor(Color.parseColor("#FFF2CF")); gravity=Gravity.CENTER
                setPadding(dp(5),dp(2),dp(5),dp(2)); background=shape("#321B19",8)
            }
            column.addView(status)
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                y = topInset() + dp(8); title = "Driftless live count"
            }
            try { wm.addView(column,params); root=column } catch (_: RuntimeException) {face=null;count=null;status=null;return}
        }
        updateFace(value.mood)
        if (count?.text?.toString() != value.text && count?.text?.isNotEmpty() == true && motionEnabled()) {
            count?.animate()?.cancel()
            count?.scaleX=1.1f; count?.scaleY=1.1f
            count?.animate()?.scaleX(1f)?.scaleY(1f)?.setDuration(180)?.start()
        }
        count?.text=value.text; status?.text=value.status
    }
    fun hide() {
        idle?.cancel(); idle=null
        face?.animate()?.cancel(); count?.animate()?.cancel()
        root?.let {runCatching {wm.removeViewImmediate(it)}}
        root=null;face=null;mood=null;count=null;status=null
    }
}
