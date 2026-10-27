package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R

/** A small, dismissible invitation over a recognized feed. Outside touches pass through. */
class WrapReadyOverlay(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: ScrollView? = null
    val isShowing get() = root != null
    private fun dp(value: Int) = (value * service.resources.displayMetrics.density).toInt()
    private fun rounded(color: String, radius: Int) = GradientDrawable().apply {
        setColor(Color.parseColor(color)); cornerRadius = dp(radius).toFloat()
    }

    fun show(wrap: ReadyWrap, onOpen: () -> Unit): Boolean {
        if (isShowing) return false
        val compact = service.resources.displayMetrics.run { heightPixels / density < 500 }
        val column = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            val padding = dp(if (compact) 16 else 20)
            setPadding(padding, padding, padding, padding)
        }
        column.addView(ImageView(service).apply {
            setImageResource(R.drawable.scrollsnooze_fresh)
            importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
            scaleType = ImageView.ScaleType.FIT_CENTER
        }, LinearLayout.LayoutParams(dp(if (compact) 48 else 80), dp(if (compact) 48 else 80)))
        column.addView(TextView(service).apply {
            text = "Your ${if (wrap.period == "weekly") "weekly" else "daily"} wrap is ready"
            textSize = if (compact) 22f else 24f; typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#FFF9ED")); gravity = Gravity.CENTER
            if (android.os.Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        column.addView(TextView(service).apply {
            text = if (wrap.period == "weekly") "Look back at your last completed week."
                else "Take a look at yesterday’s activity."
            textSize = if (compact) 14f else 16f; setTextColor(Color.parseColor("#C7BDAA")); gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
        fun button(label: String, primary: Boolean, action: () -> Unit) {
            column.addView(Button(service).apply {
                text = label; textSize = 16f; isAllCaps = false; minHeight = dp(52)
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor(if (primary) "#442600" else "#FFF9ED"))
                background = rounded(if (primary) "#FFD399" else "#29251D", 28)
                setPadding(dp(16), dp(12), dp(16), dp(12))
                setOnClickListener { hide(); action() }
            }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(if (primary && !compact) 20 else 8) })
        }
        button("See my Wrapped", true, onOpen)
        button("Keep watching", false) {}
        val maxHeight = service.resources.displayMetrics.heightPixels - dp(80)
        val scroller = object : ScrollView(service) {
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                super.onMeasure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(maxHeight.coerceAtLeast(dp(120)), MeasureSpec.AT_MOST))
            }
        }.apply {
            background = rounded("#201B16", 28)
            clipToOutline = true; addView(column)
        }
        val width = minOf(dp(360), service.resources.displayMetrics.widthPixels - dp(32))
        val params = WindowManager.LayoutParams(width, -2, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dp(24); title = "ScrollSnooze wrap ready"
        }
        return try {
            wm.addView(scroller, params); root = scroller
            true
        } catch (_: RuntimeException) { false }
    }

    fun hide() {
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root = null
    }
}
