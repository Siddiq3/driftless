package app.driftless.tracking.android

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R

/** Shared visual tokens for the native activity and accessibility overlay, matching the website. */
internal object PauseStyle {
    val background = Color.parseColor("#111C30")
    val violet = Color.parseColor("#493063")
    val indigo = Color.parseColor("#25274A")
    val surface = Color.parseColor("#22324C")
    val text = Color.parseColor("#F4F6FF")
    val muted = Color.parseColor("#B8C6DC")
    val lilac = Color.parseColor("#D6C5FF")
    val lilacBright = Color.parseColor("#E9DDFF")
    val ink = Color.parseColor("#292140")
    val border = Color.parseColor("#536581")
    val ripple = Color.parseColor("#26FFFFFF")
    const val gutter = 24
    const val gap = 16
    const val touch = 56
    const val radius = 20
    fun canvas() = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(violet, indigo, background))
}

/** Presentation only. All decisions, scope guards and button actions stay with the caller. */
internal class PauseSurface(context: Context) : ScrollView(context) {
    private val palette = PauseStyle
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(dp(palette.gutter), dp(16), dp(palette.gutter), dp(20))
    }
    private fun text(size: Float, color: Int = palette.text) = TextView(context).apply {
        textSize = size
        setTextColor(color)
        gravity = Gravity.CENTER
        setLineSpacing(dp(3).toFloat(), 1f)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    }
    private fun shape(color: Int, radius: Int = palette.radius, outline: Boolean = false) = GradientDrawable().apply {
        cornerRadius = dp(radius).toFloat()
        setColor(color)
        if (outline) setStroke(dp(1), palette.border)
    }
    private fun margin(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(-1, -2).apply {
        topMargin = dp(top); bottomMargin = dp(bottom)
    }
    val status = text(13f, palette.lilac).apply {
        setTypeface(typeface, Typeface.BOLD)
        background = shape(palette.surface, 999)
        setPadding(dp(16), dp(8), dp(16), dp(8))
    }
    val mascot = ImageView(context).apply {
        setImageResource(R.drawable.scrollsnooze_meditating)
        scaleType = ImageView.ScaleType.FIT_CENTER
        contentDescription = "ScrollSnooze meditating peacefully, taking a pause from the feed"
    }
    val headline = text(32f).apply {
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
        if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
    }
    val summary = text(15f, palette.muted)
    val detection = text(12f, palette.muted).apply { visibility = View.GONE }
    private val details = text(13f, palette.muted).apply {
        gravity = Gravity.START
        setPadding(0, dp(8), 0, dp(12))
        visibility = View.GONE
    }
    private val detailsButton = Button(context).apply {
        text = "Pause details"
        isAllCaps = false
        stateListAnimator = null
        elevation = 0f
        textSize = 13f
        minHeight = dp(48)
        setTextColor(palette.muted)
        background = RippleDrawable(ColorStateList.valueOf(palette.ripple), shape(Color.TRANSPARENT, 12), null)
        setOnClickListener {
            val expanded = details.visibility != View.VISIBLE
            details.visibility = if (expanded) View.VISIBLE else View.GONE
            text = if (expanded) "Hide pause details" else "Pause details"
            contentDescription = if (expanded) "Pause details, expanded. Collapse details" else "Pause details, collapsed. Expand details"
        }
        contentDescription = "Pause details, collapsed. Expand details"
    }
    private val actions = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
    }

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        background = palette.canvas()
        setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val safe = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        addView(content, LayoutParams(-1, -1))
        content.addView(text(18f).apply {
            text = "ScrollSnooze"
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            gravity = Gravity.START
            setPadding(0, dp(8), 0, dp(8))
        }, margin(bottom = 16))
        val hero = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }
        content.addView(hero, LinearLayout.LayoutParams(-1, -2, 1f))
        val compact = resources.configuration.screenHeightDp < 720
        val imageSize = if (compact) 164 else 208
        hero.addView(mascot, LinearLayout.LayoutParams(dp(imageSize), dp(imageSize)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(16); bottomMargin = dp(24)
        })
        hero.addView(status, LinearLayout.LayoutParams(-2, -2).apply { gravity = Gravity.CENTER_HORIZONTAL; bottomMargin = dp(16) })
        hero.addView(headline, margin(bottom = 12))
        hero.addView(summary, margin(bottom = 24))
        content.addView(actions, margin(top = 8))
        content.addView(detection, margin(top = 12))
        content.addView(detailsButton, margin(top = 4))
        content.addView(details, margin())
    }

    fun present(state: String, title: String, body: String, explanation: String) {
        // Tick updates must not re-announce unchanged copy or reset the expanded details.
        if (status.text.toString() != state) status.text = state
        if (headline.text.toString() != title) headline.text = title
        if (summary.text.toString() != body) summary.text = body
        if (details.text.toString() != explanation) details.text = explanation
    }

    fun action(label: String, primary: Boolean = false, callback: () -> Unit): Button = Button(context).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        elevation = 0f
        textSize = 16f
        setTypeface(typeface, Typeface.BOLD)
        minHeight = dp(palette.touch)
        minimumHeight = dp(palette.touch)
        setPadding(dp(20), dp(14), dp(20), dp(14))
        setTextColor(if (primary) palette.ink else palette.text)
        val fill = if (primary) GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(palette.lilacBright, palette.lilac)).apply {
            cornerRadius = dp(999).toFloat()
        } else shape(palette.surface, 999, outline = true)
        background = RippleDrawable(ColorStateList.valueOf(palette.ripple), fill, null)
        setOnClickListener { if (isEnabled) callback() }
        actions.addView(this, margin(top = 12))
    }
}
