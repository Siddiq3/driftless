package app.driftless.tracking.android

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R
import app.driftless.tracking.core.BlockPolicy
import app.driftless.tracking.core.CountBadgeMood

/**
 * Driftless's own full-screen pause (D-013). It is a normal activity, not an overlay: the user can
 * always leave it (Back, Home, Recents), switch the counter off in Settings, or snooze.
 * It never covers system UI or Driftless itself.
 */
class PauseActivity : Activity() {
    private var floatAnimation: ValueAnimator? = null
    private var mascot: BlinkingBrainView? = null

    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()) {
            floatAnimation = ValueAnimator.ofFloat(0f, -6f * resources.displayMetrics.density, 0f).apply {
                duration = 3200L
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
                addUpdateListener { mascot?.translationY = it.animatedValue as Float }
                start()
            }
        }
    }

    override fun onPause() {
        floatAnimation?.cancel()
        floatAnimation = null
        mascot?.translationY = 0f
        super.onPause()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pkg = intent.getStringExtra(EXTRA_PKG).orEmpty()
        val reason = intent.getStringExtra(EXTRA_REASON).orEmpty()
        val prefs = TrackingPrefs(this)
        val label = RulesLoader.load(this).apps[pkg]?.label ?: "this app"

        fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
        fun text(s: String, size: Float, color: Int) = TextView(this).apply {
            this.text = s
            setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
            setTextColor(color)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(8))
        }
        fun button(s: String, primary: Boolean, onClick: () -> Unit) = Button(this).apply {
            this.text = s
            isAllCaps = false
            minHeight = dp(54)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (primary) Color.parseColor("#643800") else Color.parseColor("#FFE8B0"))
            background = GradientDrawable().apply {
                cornerRadius = dp(28).toFloat()
                setColor(if (primary) Color.parseColor("#FFE8B0") else Color.parseColor("#2B2217"))
                setStroke(dp(1), Color.parseColor("#51412A"))
            }
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(12)
            }
        }

        val title = if (reason == "SCHEDULE") "Your offline era starts now." else "Plot twist: we log off."
        val body = if (reason == "SCHEDULE") {
            "You made room for life beyond $label.\nLet’s keep that promise to yourself."
        } else {
            "Today’s video allowance is used.\nYour next side quest is off-screen."
        }
        val snoozesLeft = BlockPolicy.MAX_SNOOZES_PER_DAY - prefs.snoozesToday()

        setContentView(
            ScrollView(this).apply {
                isFillViewport = true
                setBackgroundColor(Color.parseColor("#0B0B08"))
                addView(LinearLayout(this@PauseActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setPadding(dp(24), dp(24), dp(24), dp(24))
                    addView(text(if (reason == "SCHEDULE") "✦  FOCUS MODE  ✦" else "✦  DAILY LIMIT REACHED  ✦", 12f, Color.parseColor("#FFD399")).apply {
                        letterSpacing = .12f
                        setTypeface(typeface, Typeface.BOLD)
                    })
                    addView(text(if (reason == "SCHEDULE") "Focus mode. Main character energy." else "Bestie, my brain needs a breather.", 15f, Color.parseColor("#442600")).apply {
                        setTypeface(typeface, Typeface.BOLD)
                        background = GradientDrawable().apply {
                            setColor(Color.parseColor("#FFE5AA"))
                            cornerRadius = dp(24).toFloat()
                        }
                        setPadding(dp(20), dp(12), dp(20), dp(12))
                        layoutParams = LinearLayout.LayoutParams(-2, -2).apply {
                            gravity = Gravity.CENTER_HORIZONTAL
                            topMargin = dp(20)
                        }
                    })
                    mascot = BlinkingBrainView(this@PauseActivity).apply {
                        val scheduled = reason == "SCHEDULE"
                        setImageResource(if (scheduled) R.drawable.scrollsnooze_focused else R.drawable.scrollsnooze_drained)
                        // Focused artwork has different eyes; only drained art uses the eyelid animation.
                        setMood(if (scheduled) CountBadgeMood.UNKNOWN else CountBadgeMood.DRAINED)
                        scaleType = ImageView.ScaleType.FIT_CENTER
                        contentDescription = if (scheduled) "Your brain taking a quiet break" else "Your tired brain asking for a break"
                        layoutParams = LinearLayout.LayoutParams(dp(208), dp(208)).apply {
                            gravity = Gravity.CENTER_HORIZONTAL
                            topMargin = dp(12)
                            bottomMargin = dp(8)
                        }
                    }
                    addView(mascot)
                    addView(text(title, 30f, Color.parseColor("#FFF9ED")).apply { setTypeface(typeface, Typeface.BOLD) })
                    addView(text(body, 16f, Color.parseColor("#C4B69D")))
                    addView(text(if (reason == "SCHEDULE") "Your focus schedule is active for $label." else "Reels & Shorts reset on the next local day.", 13f, Color.parseColor("#E8D8BA")).apply {
                        background = GradientDrawable().apply {
                            setColor(Color.parseColor("#201B16"))
                            cornerRadius = dp(18).toFloat()
                        }
                        setPadding(dp(16), dp(12), dp(16), dp(12))
                        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14); bottomMargin = dp(6) }
                })
                addView(button("Leave feed · take a breather", primary = true) { goHome() })
                if (snoozesLeft > 0) {
                    addView(
                        button("5 more minutes · $snoozesLeft bypasses left today", primary = false) {
                            prefs.snooze(pkg, System.currentTimeMillis() + BlockPolicy.SNOOZE_MS)
                            finish()
                        },
                    )
                }
                addView(
                    button("Open ScrollSnooze", primary = false) {
                        packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
                        finish()
                    },
                )
                addView(text("Home and Back are always available. Manage pauses in ScrollSnooze or Android Accessibility settings. Media may keep playing underneath.", 11f, Color.parseColor("#C4B69D")))
                })
            },
        )
    }

    @Deprecated("Back leaves the blocked app, like Leave feed.")
    override fun onBackPressed() {
        goHome()
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    companion object {
        const val EXTRA_PKG = "pkg"
        const val EXTRA_REASON = "reason"
    }
}
