package app.driftless.tracking.android

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.TextView
import android.graphics.Typeface
import app.driftless.tracking.core.BlockPolicy
import app.driftless.tracking.R

/**
 * Driftless's own full-screen pause (D-013). It is a normal activity, not an overlay: the user can
 * always leave it (Back, Home, Recents), switch the counter off in Settings, or snooze.
 * It never covers system UI or Driftless itself.
 */
class PauseActivity : Activity() {
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
            minHeight = dp(48)
            setTextColor(if (primary) Color.parseColor("#643800") else Color.parseColor("#FFE8B0"))
            background = GradientDrawable().apply {
                cornerRadius = dp(24).toFloat()
                setColor(if (primary) Color.parseColor("#FFE8B0") else Color.parseColor("#2B2217"))
                setStroke(dp(1), Color.parseColor("#51412A"))
            }
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(12)
            }
        }

        val title = if (reason == "SCHEDULE") "Focus time" else "You've reached today's limit"
        val body = if (reason == "SCHEDULE") {
            "You asked Driftless to pause $label during this time."
        } else {
            "You set a daily limit for $label. Wick is glad you're taking a break."
        }
        val snoozesLeft = BlockPolicy.MAX_SNOOZES_PER_DAY - prefs.snoozesToday()

        setContentView(
            ScrollView(this).apply {
                isFillViewport = true
                setBackgroundColor(Color.parseColor("#120E09"))
                addView(LinearLayout(this@PauseActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setPadding(dp(32), dp(32), dp(32), dp(32))
                    addView(text("DRIFTLESS · TAKE A BREATH", 12f, Color.parseColor("#FFE8B0")))
                    addView(ImageView(this@PauseActivity).apply {
                        setImageResource(R.drawable.wick_focus)
                        scaleType = ImageView.ScaleType.FIT_CENTER
                        contentDescription = "Wick taking a pause"
                        layoutParams = LinearLayout.LayoutParams(dp(220), dp(220)).apply {
                            gravity = Gravity.CENTER_HORIZONTAL
                            topMargin = dp(16)
                            bottomMargin = dp(16)
                        }
                    })
                addView(text(title, 30f, Color.parseColor("#FFF9ED")).apply { setTypeface(typeface, Typeface.BOLD) })
                addView(text(body, 16f, Color.parseColor("#C4B69D")))
                addView(button("Close $label", primary = true) { goHome() })
                if (snoozesLeft > 0) {
                    addView(
                        button("5 more minutes ($snoozesLeft left today)", primary = false) {
                            prefs.snooze(pkg, System.currentTimeMillis() + BlockPolicy.SNOOZE_MS)
                            finish()
                        },
                    )
                }
                addView(
                    button("Open Driftless", primary = false) {
                        packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
                        finish()
                    },
                )
                addView(text("You can turn blocking off in Driftless or in Settings › Accessibility.", 12f, Color.parseColor("#C4B69D")))
                })
            },
        )
    }

    @Deprecated("Back leaves the blocked app, like Close.")
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
