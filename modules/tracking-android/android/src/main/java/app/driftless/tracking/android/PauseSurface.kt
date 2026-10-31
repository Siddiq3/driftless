package app.driftless.tracking.android

import android.animation.ValueAnimator
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
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R

/** Shared visual tokens for the native activity and accessibility overlay, matching the app. */
internal object PauseStyle {
    val background = Color.parseColor("#0B0B08")
    val surface = Color.parseColor("#29271F")
    val text = Color.parseColor("#FFFFF8")
    val muted = Color.parseColor("#B4B3AA")
    val accent = Color.parseColor("#FFD18E")
    val ink = Color.parseColor("#4B2C0C")
    val ripple = Color.parseColor("#26FFFFFF")
    const val gutter = 24
    const val touch = 56
}

/** Presentation only. All decisions, scope guards and button actions stay with the caller. */
internal class PauseSurface(context: Context) : ScrollView(context) {
    private val palette = PauseStyle
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private val displayFace = if (Build.VERSION.SDK_INT >= 26) resources.getFont(R.font.lilita_one)
        else Typeface.create("sans-serif", Typeface.BOLD)
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
    private fun margin(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(-1, -2).apply {
        topMargin = dp(top); bottomMargin = dp(bottom)
    }
    /** The hero: a countdown or today's count. Hidden when a pause has no number to show. */
    val figure = text(84f, palette.accent).apply { typeface = displayFace; visibility = View.GONE }
    val figureLabel = text(15f, palette.muted).apply { visibility = View.GONE }
    val headline = text(32f).apply {
        typeface = displayFace
        if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
    }
    val summary = text(16f, palette.muted)
    val detection = text(13f, palette.muted)
    private val actions = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
    }
    private val breath = View(context).apply {
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(palette.accent) }
        alpha = .12f
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private var breathing: ValueAnimator? = null

    init {
        isFillViewport = true
        isVerticalScrollBarEnabled = false
        setBackgroundColor(palette.background)
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
        val hero = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }
        content.addView(hero, LinearLayout.LayoutParams(-1, 0, 1f))
        val compact = resources.configuration.screenHeightDp < 720
        val stage = if (compact) 150 else 200
        val mascot = ImageView(context).apply {
            setImageResource(R.drawable.scrollsnooze_meditating)
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = "ScrollSnooze taking a pause from the feed"
        }
        hero.addView(FrameLayout(context).apply {
            addView(breath, FrameLayout.LayoutParams(-1, -1))
            val inset = dp(18)
            addView(mascot, FrameLayout.LayoutParams(-1, -1).apply { setMargins(inset, inset, inset, inset) })
        }, LinearLayout.LayoutParams(dp(stage), dp(stage)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = dp(20)
        })
        hero.addView(figure, margin())
        hero.addView(figureLabel, margin(bottom = 20))
        hero.addView(headline, margin(bottom = 10))
        hero.addView(summary, margin())
        content.addView(actions, margin(top = 20))
        content.addView(detection, margin(top = 12))
    }

    /** One slow breath in and out, stopped with the window and off when animations are off. */
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled()) return
        breathing = ValueAnimator.ofFloat(.82f, 1f).apply {
            duration = 4000
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener {
                val v = it.animatedValue as Float
                breath.scaleX = v; breath.scaleY = v
                breath.alpha = .06f + (v - .82f) * .6f
            }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        breathing?.cancel()
        breathing = null
        super.onDetachedFromWindow()
    }

    fun present(title: String, body: String, number: String? = null, numberLabel: String? = null, note: String = FOOTER) {
        // Tick updates must not re-announce unchanged copy.
        if (headline.text.toString() != title) headline.text = title
        if (summary.text.toString() != body) summary.text = body
        if (figure.text.toString() != (number ?: "")) figure.text = number ?: ""
        if (figureLabel.text.toString() != (numberLabel ?: "")) figureLabel.text = numberLabel ?: ""
        figure.visibility = if (number == null) View.GONE else View.VISIBLE
        figureLabel.visibility = if (number == null) View.GONE else View.VISIBLE
        if (detection.text.toString() != note) detection.text = note
    }

    /** Primary is the one filled amber action; quiet actions read as text links. */
    fun action(label: String, primary: Boolean = false, quiet: Boolean = false, callback: () -> Unit): Button = Button(context).apply {
        text = label
        isAllCaps = false
        stateListAnimator = null
        elevation = 0f
        textSize = 16f
        setTypeface(typeface, Typeface.BOLD)
        minHeight = dp(if (quiet) 48 else palette.touch)
        minimumHeight = dp(if (quiet) 48 else palette.touch)
        setPadding(dp(20), dp(14), dp(20), dp(14))
        setTextColor(if (primary) palette.ink else if (quiet) palette.muted else palette.text)
        val fill = GradientDrawable().apply {
            cornerRadius = dp(999).toFloat()
            setColor(if (primary) palette.accent else if (quiet) Color.TRANSPARENT else palette.surface)
        }
        background = RippleDrawable(ColorStateList.valueOf(palette.ripple), fill, null)
        setOnClickListener { if (isEnabled) callback() }
        actions.addView(this, margin(top = if (quiet) 4 else 12))
    }

    companion object {
        const val FOOTER = "Back and Home always work."
    }
}
