package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import app.driftless.tracking.R

/**
 * "Your wrap is ready" teaser shown once per day over a recognized Reels/Shorts player.
 * It reveals nothing from the wrap itself (the number stays hidden as "???") so the only way
 * to find out is to open ScrollSnooze. Tapping outside or "Later" dismisses it.
 */
class WrapReadyCard(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: FrameLayout? = null
    private val animators = mutableListOf<ValueAnimator>()
    val isShowing get() = root != null

    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()
    private fun gradient(vararg colors: String, radius: Int, orientation: GradientDrawable.Orientation =
        GradientDrawable.Orientation.TL_BR) = GradientDrawable(orientation, colors.map { Color.parseColor(it) }.toIntArray())
        .apply { cornerRadius = dp(radius).toFloat() }
    private val animate get() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()

    /** [shorts] only changes the wording ("Shorts" vs "reels"). Returns true when the card is on screen. */
    fun show(shorts: Boolean, onOpen: () -> Unit): Boolean {
        if (isShowing) return false
        val noun = if (shorts) "Shorts" else "reels"
        val backdrop = FrameLayout(service).apply {
            setBackgroundColor(Color.parseColor("#C0000000"))
            setOnClickListener { hide() }
        }
        val card = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(20), dp(18), dp(20), dp(20))
            background = gradient("#2A1450", "#140A2A", "#3A0F33", radius = 32).apply {
                setStroke(dp(1), Color.parseColor("#7A55C8"))
            }
            setOnClickListener { } // card taps never dismiss
        }

        // Top row: "YESTERDAY'S WRAP" pill + close
        val header = LinearLayout(service).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(TextView(service).apply {
            text = "🎁  YESTERDAY'S WRAP"; textSize = 12f; letterSpacing = 0.12f; typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#FFD9F2")); setPadding(dp(12), dp(6), dp(12), dp(6))
            background = gradient("#5B2A8C", "#8C2A6E", radius = 20, orientation = GradientDrawable.Orientation.LEFT_RIGHT)
        }, LinearLayout.LayoutParams(-2, -2))
        header.addView(View(service), LinearLayout.LayoutParams(0, 1, 1f))
        header.addView(Button(service).apply {
            text = "×"; textSize = 22f; isAllCaps = false; contentDescription = "Close"
            setTextColor(Color.parseColor("#E9DCFF")); background = gradient("#33204F", "#33204F", radius = 24)
            setOnClickListener { hide() }
        }, LinearLayout.LayoutParams(dp(44), dp(44)))
        card.addView(header, LinearLayout.LayoutParams(-1, -2))

        // Mascot holding its wrap, with a soft glow behind it
        val art = FrameLayout(service)
        val glow = View(service).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(90).toFloat()
                colors = intArrayOf(Color.parseColor("#99B67CFF"), Color.parseColor("#00B67CFF"))
            }
        }
        art.addView(glow, FrameLayout.LayoutParams(dp(190), dp(190), Gravity.CENTER))
        val heightDp = service.resources.displayMetrics.heightPixels / service.resources.displayMetrics.density
        val brainSize = if (heightDp < 650) 120 else 150
        val brain = ImageView(service).apply {
            setImageResource(R.drawable.scrollsnooze_wrapped)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        art.addView(brain, FrameLayout.LayoutParams(dp(brainSize), dp(brainSize), Gravity.CENTER))
        card.addView(art, LinearLayout.LayoutParams(-1, dp(brainSize + 30)).apply { topMargin = dp(4) })

        card.addView(TextView(service).apply {
            text = "Your $noun day is wrapped 👀"; textSize = 23f; gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD; setTextColor(Color.parseColor("#FFFFFF"))
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })
        card.addView(TextView(service).apply {
            text = "Guess how many $noun you scrolled yesterday…\nYour wrap knows. 🤫"
            textSize = 15f; gravity = Gravity.CENTER; setLineSpacing(0f, 1.15f)
            setTextColor(Color.parseColor("#D9CCF2"))
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })

        // The hidden number — the hook
        val mystery = TextView(service).apply {
            text = "? ? ?"; textSize = 30f; gravity = Gravity.CENTER; typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.1f; setTextColor(Color.parseColor("#FFE38A"))
            setPadding(dp(24), dp(6), dp(24), dp(6))
            background = gradient("#3D2266", "#2A1748", radius = 18).apply { setStroke(dp(1), Color.parseColor("#FFE38A")) }
            contentDescription = "Hidden number"
        }
        card.addView(mystery, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(14); gravity = Gravity.CENTER_HORIZONTAL })

        val open = Button(service).apply {
            text = "Unwrap it ✨"; textSize = 17f; isAllCaps = false; typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#2B0A3D")); minHeight = dp(54)
            background = gradient("#FFE38A", "#FF9BD2", "#B98CFF", radius = 27, orientation = GradientDrawable.Orientation.LEFT_RIGHT)
            setOnClickListener { hide(); onOpen() }
        }
        card.addView(open, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(18) })
        card.addView(Button(service).apply {
            text = "Later"; textSize = 15f; isAllCaps = false
            setTextColor(Color.parseColor("#BFAEE0")); background = null; minHeight = dp(48)
            setOnClickListener { hide() }
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })

        val width = minOf(dp(340), service.resources.displayMetrics.widthPixels - dp(32))
        backdrop.addView(card, FrameLayout.LayoutParams(width, -2, Gravity.CENTER))
        val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.CENTER; title = "ScrollSnooze wrap ready"
        }
        return try {
            wm.addView(backdrop, params); root = backdrop
            if (animate) {
                card.alpha = 0f; card.scaleX = 0.85f; card.scaleY = 0.85f; card.translationY = dp(30).toFloat()
                card.animate().alpha(1f).scaleX(1f).scaleY(1f).translationY(0f)
                    .setInterpolator(OvershootInterpolator(1.2f)).setDuration(420).start()
                loop(ObjectAnimator.ofFloat(brain, View.TRANSLATION_Y, 0f, -dp(8).toFloat()), 1400)
                loop(ObjectAnimator.ofFloat(brain, View.ROTATION, -4f, 4f), 1800)
                loop(ObjectAnimator.ofFloat(glow, View.ALPHA, 0.55f, 1f), 1600)
                loop(ObjectAnimator.ofFloat(mystery, View.ALPHA, 0.6f, 1f), 900)
                loop(ObjectAnimator.ofFloat(open, View.SCALE_X, 1f, 1.035f), 1100)
                loop(ObjectAnimator.ofFloat(open, View.SCALE_Y, 1f, 1.035f), 1100)
            }
            true
        } catch (_: RuntimeException) { root = null; false }
    }

    private fun loop(a: ObjectAnimator, ms: Long) {
        a.duration = ms; a.repeatCount = ValueAnimator.INFINITE; a.repeatMode = ValueAnimator.REVERSE
        a.interpolator = AccelerateDecelerateInterpolator(); a.start(); animators += a
    }

    fun hide() {
        animators.forEach { it.cancel() }; animators.clear()
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root = null
    }
}
