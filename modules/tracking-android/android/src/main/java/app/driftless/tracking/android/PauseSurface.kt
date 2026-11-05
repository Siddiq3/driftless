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
        setPadding(dp(palette.gutter), dp(20), dp(palette.gutter), dp(20))
    }
    private fun text(size: Float, color: Int = palette.text, center: Boolean = true) = TextView(context).apply {
        textSize = size
        setTextColor(color)
        gravity = if (center) Gravity.CENTER else Gravity.START
        setLineSpacing(dp(3).toFloat(), 1f)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    }
    private fun margin(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(-1, -2).apply {
        topMargin = dp(top); bottomMargin = dp(bottom)
    }
    private fun rounded(color: Int, radius: Int = 20) = GradientDrawable().apply {
        cornerRadius = dp(radius).toFloat(); setColor(color)
    }
    /** A countdown or today's count, as an amber pill. Hidden when a pause has no number to show. */
    val figure = text(30f, palette.accent).apply { typeface = displayFace }
    val figureLabel = text(15f, palette.muted)
    private val figurePill = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = rounded(palette.surface, 999)
        setPadding(dp(18), dp(8), dp(20), dp(8))
        visibility = View.GONE
        addView(figure)
        addView(figureLabel, LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(10) })
    }
    val headline = text(34f).apply {
        typeface = displayFace
        if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
    }
    val summary = text(16f, palette.muted)
    val detection = text(13f, palette.muted, center = true)
    private val questRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    private val questTitle = text(15f, palette.text).apply {
        text = "Pick a side quest"
        setTypeface(typeface, Typeface.BOLD)
        visibility = View.GONE
    }
    private val actions = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    private val tiles = mutableListOf<View>()
    private fun glow(color: Int) = View(context).apply {
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val glowOuter = glow(Color.parseColor("#B79CFF")).apply { alpha = .16f }
    private val glowInner = glow(palette.accent).apply { alpha = .14f }
    private val sparkles = List(3) {
        text(if (it == 1) 22f else 16f, palette.accent).apply {
            text = "✦"; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
    }
    private val loops = mutableListOf<ValueAnimator>()

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
        val compact = resources.configuration.screenHeightDp < 720
        val stage = if (compact) 170 else 220
        // A different playful line each time, so the pause never feels like the same telling-off.
        content.addView(text(18f, palette.ink).apply {
            text = LINES.random()
            typeface = displayFace
            setPadding(dp(18), dp(10), dp(18), dp(12))
            background = rounded(palette.text, 22)
        }, LinearLayout.LayoutParams(-2, -2).apply { gravity = Gravity.CENTER_HORIZONTAL })
        content.addView(FrameLayout(context).apply {
            clipChildren = false
            addView(glowOuter, FrameLayout.LayoutParams(-1, -1))
            val inner = dp(stage / 6)
            addView(glowInner, FrameLayout.LayoutParams(-1, -1).apply { setMargins(inner, inner, inner, inner) })
            val inset = dp(18)
            addView(ImageView(context).apply {
                setImageResource(R.drawable.scrollsnooze_meditating)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "ScrollSnooze brain taking a calm break"
            }, FrameLayout.LayoutParams(-1, -1).apply { setMargins(inset, inset, inset, inset) })
            // Sparkles sit around the glow: top-left, top-right, lower-right.
            listOf(Gravity.TOP or Gravity.START, Gravity.TOP or Gravity.END, Gravity.BOTTOM or Gravity.END)
                .zip(sparkles).forEach { (where, star) -> addView(star, FrameLayout.LayoutParams(-2, -2, where)) }
        }, LinearLayout.LayoutParams(dp(stage), dp(stage)).apply {
            gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(6); bottomMargin = dp(14)
        })
        content.addView(headline, margin(bottom = 8))
        content.addView(summary, margin())
        content.addView(figurePill, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(16); gravity = Gravity.CENTER_HORIZONTAL })
        content.addView(View(context), LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = dp(20) })
        content.addView(questTitle, margin(bottom = 10))
        content.addView(questRow, margin())
        content.addView(actions, margin(top = 8))
        content.addView(detection, margin(top = 12))
    }

    /**
     * Three tiny offline quests. Any of them leaves the feed through [onPick]; the app can't verify a
     * quest, so they stay light invitations, never chores.
     */
    fun quests(onPick: () -> Unit) {
        if (tiles.isNotEmpty()) return
        questTitle.visibility = View.VISIBLE
        listOf("💧" to "Drink water", "🧘" to "Stretch", "💬" to "Text a friend").forEachIndexed { i, (mark, label) ->
            val tile = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                minimumHeight = dp(104)
                setPadding(dp(8), dp(14), dp(8), dp(14))
                background = RippleDrawable(ColorStateList.valueOf(palette.ripple), rounded(palette.surface), null)
                isClickable = true
                isFocusable = true
                contentDescription = "Side quest: $label. Leaves the feed."
                addView(text(30f, center = true).apply {
                    text = mark; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                })
                addView(text(14f, center = true).apply {
                    text = label; setTypeface(typeface, Typeface.BOLD)
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(6) })
                setOnClickListener { onPick() }
            }
            tiles += tile
            questRow.addView(tile, LinearLayout.LayoutParams(0, -2, 1f).apply { if (i > 0) marginStart = dp(10) })
        }
    }

    /**
     * The calm loop: the glow breathes in and out (4s) while sparkles twinkle, and the quests pop in
     * once. Everything is skipped when the phone has animations turned off.
     */
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled()) return
        loops += ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 4000; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            addUpdateListener {
                val v = it.animatedValue as Float
                glowOuter.scaleX = .84f + v * .16f; glowOuter.scaleY = glowOuter.scaleX; glowOuter.alpha = .10f + v * .14f
                glowInner.scaleX = 1f - v * .10f; glowInner.scaleY = glowInner.scaleX; glowInner.alpha = .10f + (1 - v) * .12f
            }
            start()
        }
        sparkles.forEachIndexed { i, star ->
            loops += ValueAnimator.ofFloat(.15f, 1f).apply {
                duration = 1400L + i * 500L; startDelay = i * 450L
                repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE
                addUpdateListener { val v = it.animatedValue as Float; star.alpha = v; star.scaleX = .7f + v * .4f; star.scaleY = star.scaleX }
                start()
            }
        }
        tiles.forEachIndexed { i, tile ->
            tile.alpha = 0f; tile.scaleX = .86f; tile.scaleY = .86f
            tile.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(220L + i * 90L).setDuration(320)
                .setInterpolator(android.view.animation.OvershootInterpolator(1.6f)).start()
        }
    }

    override fun onDetachedFromWindow() {
        loops.forEach { it.cancel() }; loops.clear()
        tiles.forEach { it.animate().cancel(); it.alpha = 1f; it.scaleX = 1f; it.scaleY = 1f }
        super.onDetachedFromWindow()
    }

    fun present(title: String, body: String, number: String? = null, numberLabel: String? = null, note: String = FOOTER) {
        // Tick updates must not re-announce unchanged copy.
        if (headline.text.toString() != title) headline.text = title
        if (summary.text.toString() != body) summary.text = body
        if (figure.text.toString() != (number ?: "")) figure.text = number ?: ""
        if (figureLabel.text.toString() != (numberLabel ?: "")) figureLabel.text = numberLabel ?: ""
        val shown = if (number == null) View.GONE else View.VISIBLE
        figurePill.visibility = shown; figure.visibility = shown; figureLabel.visibility = shown
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
        actions.addView(this, margin(top = if (quiet) 4 else 10))
    }

    companion object {
        const val FOOTER = "Back and Home always work."
        /** Playful openers; one is picked per pause. Never guilt, always the buddy. */
        val LINES = listOf(
            "Brain spa time 🧘", "Plot twist: you stop here 😌", "Side quest unlocked! ✨",
            "Hydrate, legend 💧", "Your thumb called. It wants a break.", "Touch grass? 🌱",
            "Main character break 🎬", "The feed can wait. You can't. 😉",
        )
    }
}
