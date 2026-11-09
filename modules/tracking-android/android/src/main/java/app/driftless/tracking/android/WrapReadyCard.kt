package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import app.driftless.tracking.R

/**
 * "Your wrap is ready" teaser shown once per day over a recognized Reels/Shorts player.
 * The mascot stands on top of the card holding its recap; the count stays hidden ("??") so the
 * only way to find out is to open ScrollSnooze. Tapping outside, ×, or "Maybe later" dismisses it.
 * Colors follow the ScrollSnooze purple identity (midnight, plum, lavender, moon yellow).
 */
class WrapReadyCard(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: FrameLayout? = null
    private val animators = mutableListOf<ValueAnimator>()
    val isShowing get() = root != null

    private companion object {
        const val MIDNIGHT = "#10102B"; const val PLUM = "#211C3D"; const val PLUM_LIGHT = "#2E2752"
        const val LINE = "#3A3260"; const val LAVENDER = "#C4A0FF"; const val LAVENDER_DARK = "#9566DF"
        const val LAVENDER_HI = "#E4C5FF"; const val SOFT_WHITE = "#F7F2FF"; const val MUTED = "#B9AFCB"
        const val FAINT = "#8E85A8"; const val INDIGO = "#241642"; const val MOON = "#FFE08A"
    }

    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()
    private fun c(hex: String) = Color.parseColor(hex)
    private fun round(fill: String, radius: Int) = GradientDrawable().apply { setColor(c(fill)); cornerRadius = dp(radius).toFloat() }
    private val displayTypeface: Typeface by lazy {
        if (Build.VERSION.SDK_INT >= 26) runCatching { service.resources.getFont(R.font.lilita_one) }.getOrNull() ?: Typeface.DEFAULT_BOLD
        else Typeface.DEFAULT_BOLD
    }
    private val animate get() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()

    /** [shorts] only changes the wording. Returns true when the popup is on screen. */
    fun show(shorts: Boolean, onOpen: () -> Unit): Boolean {
        if (isShowing) return false
        val noun = if (shorts) "Shorts" else "reels"
        val one = if (shorts) "Short" else "reel"
        val metrics = service.resources.displayMetrics
        val compact = metrics.heightPixels / metrics.density < 680
        val mascotSize = if (compact) 150 else 190

        val backdrop = FrameLayout(service).apply {
            setBackgroundColor(Color.argb(200, 16, 16, 43))
            setOnClickListener { hide() }
        }
        val width = minOf(dp(330), metrics.widthPixels - dp(32))
        val stage = FrameLayout(service).apply { clipChildren = false; clipToPadding = false }

        // ---- Card ----
        val card = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(if (compact) 44 else 58), dp(22), dp(10))
            background = round(PLUM, 30).apply { setStroke(dp(1), c(LINE)) }
            setOnClickListener { } // taps on the card never dismiss
        }
        card.addView(TextView(service).apply {
            text = "YESTERDAY · DAILY WRAP"; textSize = 11f; letterSpacing = 0.14f; typeface = Typeface.DEFAULT_BOLD
            setTextColor(c(LAVENDER)); setPadding(dp(12), dp(5), dp(12), dp(5)); background = round(PLUM_LIGHT, 12)
        }, LinearLayout.LayoutParams(-2, -2))
        card.addView(TextView(service).apply {
            text = "I wrapped up\nyour $noun day"; textSize = if (compact) 25f else 29f; typeface = displayTypeface
            gravity = Gravity.CENTER; setTextColor(c(SOFT_WHITE)); setLineSpacing(0f, 0.95f)
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        card.addView(TextView(service).apply {
            text = "Every $one from yesterday, counted\nand turned into 6 little stories."
            textSize = 15f; gravity = Gravity.CENTER; setTextColor(c(MUTED)); setLineSpacing(0f, 1.15f)
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })

        // The hidden number — the hook
        val secret = LinearLayout(service).apply {
            gravity = Gravity.CENTER_VERTICAL; setPadding(dp(16), dp(10), dp(18), dp(10))
            background = round(MIDNIGHT, 20).apply { setStroke(dp(1), c("#5B4F8F"), dp(5).toFloat(), dp(4).toFloat()) }
            contentDescription = "$noun watched yesterday, hidden until you open your wrap"
        }
        val mystery = TextView(service).apply {
            text = "??"; textSize = 36f; typeface = displayTypeface; letterSpacing = 0.06f; setTextColor(c(MOON))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        secret.addView(mystery)
        secret.addView(TextView(service).apply {
            text = "$noun watched\ncan you guess?"; textSize = 13f; setTextColor(c(MUTED)); setLineSpacing(0f, 1.1f)
            setPadding(dp(12), 0, 0, 0); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        })
        card.addView(secret, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(16) })

        // Chunky lavender button with a darker "lip" underneath
        val open = TextView(service).apply {
            text = "Open my wrap ✨"; textSize = 21f; typeface = displayTypeface; gravity = Gravity.CENTER
            setTextColor(c(INDIGO)); minHeight = dp(56); isClickable = true; isFocusable = true
            contentDescription = "Open my wrap"
            background = LayerDrawable(arrayOf<android.graphics.drawable.Drawable>(round(LAVENDER_DARK, 28), round(LAVENDER, 28))).apply {
                setLayerInset(1, 0, 0, 0, dp(5))
            }
            setPadding(0, 0, 0, dp(5))
            setOnTouchListener { v, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(90).start()
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                }
                false
            }
            setOnClickListener { hide(); onOpen() }
        }
        card.addView(open, LinearLayout.LayoutParams(-1, dp(61)).apply { topMargin = dp(18) })
        card.addView(TextView(service).apply {
            text = "Maybe later"; textSize = 14f; gravity = Gravity.CENTER; setTextColor(c(FAINT))
            minHeight = dp(44); isClickable = true; setOnClickListener { hide() }
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })

        stage.addView(card, FrameLayout.LayoutParams(width, -2, Gravity.TOP).apply { topMargin = dp(mascotSize - 40) })

        // Close button in the card's corner
        val close = TextView(service).apply {
            text = "×"; textSize = 20f; gravity = Gravity.CENTER; setTextColor(c(MUTED))
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c(PLUM_LIGHT)) }
            contentDescription = "Close"; isClickable = true; setOnClickListener { hide() }
        }
        stage.addView(close, FrameLayout.LayoutParams(dp(40), dp(40), Gravity.TOP or Gravity.END).apply {
            topMargin = dp(mascotSize - 40 + 12); rightMargin = dp(12)
        })

        // ---- Mascot scene (on top of the card) ----
        val glow = View(service).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL; gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(mascotSize * 6 / 10).toFloat()
                colors = intArrayOf(Color.argb(115, 196, 160, 255), Color.argb(0, 196, 160, 255))
            }
        }
        stage.addView(glow, FrameLayout.LayoutParams(dp(mascotSize + 40), dp(mascotSize + 40), Gravity.TOP or Gravity.CENTER_HORIZONTAL)
            .apply { topMargin = -dp(10) })
        val moon = TextView(service).apply {
            text = "☾"; textSize = if (compact) 26f else 32f; setTextColor(c(MOON))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        stage.addView(moon, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply {
            topMargin = dp(if (compact) 10 else 18); rightMargin = width / 2 - dp(mascotSize / 2) - dp(4)
        })
        val sparkles = listOf(
            Triple(Gravity.END, dp(36), 18f), Triple(Gravity.END, dp(mascotSize / 2 + 10), 12f), Triple(Gravity.START, dp(mascotSize / 2), 14f),
        ).mapIndexed { i, (side, top, size) ->
            TextView(service).apply {
                text = "✦"; textSize = size; setTextColor(c(LAVENDER_HI)); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }.also {
                stage.addView(it, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or side).apply {
                    topMargin = top
                    if (side == Gravity.END) rightMargin = dp(if (i == 0) 26 else 52) else leftMargin = dp(40)
                })
            }
        }
        val mascot = BlinkingBrainView(service).apply {
            wrappedPose = true; scaleType = ImageView.ScaleType.FIT_CENTER
            setImageResource(R.drawable.scrollsnooze_wrapped)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        stage.addView(mascot, FrameLayout.LayoutParams(dp(mascotSize), dp(mascotSize), Gravity.TOP or Gravity.CENTER_HORIZONTAL))
        val bubble = TextView(service).apply {
            text = "psst… 👀"; textSize = 16f; typeface = displayTypeface; setTextColor(c(INDIGO))
            setPadding(dp(14), dp(7), dp(14), dp(8)); rotation = -6f
            background = GradientDrawable().apply {
                setColor(c(SOFT_WHITE))
                val r = dp(18).toFloat(); val tail = dp(4).toFloat()
                cornerRadii = floatArrayOf(r, r, r, r, r, r, tail, tail) // TL, TR, BR, BL — pointy toward the mascot
            }
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        stage.addView(bubble, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.START).apply {
            topMargin = dp(if (compact) 18 else 30); leftMargin = dp(4)
        })

        backdrop.addView(stage, FrameLayout.LayoutParams(width, -2, Gravity.CENTER))
        backdrop.contentDescription = "Your daily wrap from yesterday is ready"
        val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.CENTER; title = "ScrollSnooze wrap ready"
        }
        return try {
            wm.addView(backdrop, params); root = backdrop
            if (animate) {
                // Card pops in, then the mascot hops up onto it and the bubble says hi.
                card.alpha = 0f; card.scaleX = 0.9f; card.scaleY = 0.9f; card.translationY = dp(24).toFloat()
                card.animate().alpha(1f).scaleX(1f).scaleY(1f).translationY(0f)
                    .setInterpolator(OvershootInterpolator(1.1f)).setDuration(380).start()
                close.alpha = 0f; close.animate().alpha(1f).setStartDelay(250).setDuration(200).start()
                mascot.alpha = 0f; mascot.translationY = dp(70).toFloat(); mascot.scaleX = 0.8f; mascot.scaleY = 0.8f
                mascot.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f).setStartDelay(160)
                    .setInterpolator(OvershootInterpolator(1.8f)).setDuration(520)
                    .withEndAction { if (isShowing) {
                        // Squash on landing, stretch back, then settle into a gentle idle bob and sway.
                        mascot.pivotY = mascot.height.toFloat()
                        mascot.animate().scaleX(1.08f).scaleY(0.9f).setDuration(110).withEndAction {
                            mascot.animate().scaleX(0.97f).scaleY(1.04f).setDuration(140).withEndAction {
                                mascot.animate().scaleX(1f).scaleY(1f).setDuration(160).withEndAction {
                                    if (!isShowing) return@withEndAction
                                    mascot.setMood(app.driftless.tracking.core.CountBadgeMood.HAPPY)
                                    loop(ObjectAnimator.ofFloat(mascot, View.TRANSLATION_Y, 0f, -dp(6).toFloat()), 1500)
                                    loop(ObjectAnimator.ofFloat(mascot, View.ROTATION, -2.5f, 2.5f), 2200)
                                }.start()
                            }.start()
                        }.start()
                    } }.start()
                bubble.alpha = 0f; bubble.scaleX = 0.4f; bubble.scaleY = 0.4f
                bubble.pivotX = dp(70).toFloat(); bubble.pivotY = dp(30).toFloat()
                bubble.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(620)
                    .setInterpolator(OvershootInterpolator(2.2f)).setDuration(360).start()
                listOf(glow, moon).forEach { it.alpha = 0f; it.animate().alpha(1f).setStartDelay(300).setDuration(400).start() }
                loop(ObjectAnimator.ofFloat(glow, View.SCALE_X, 0.92f, 1.06f), 1800)
                loop(ObjectAnimator.ofFloat(glow, View.SCALE_Y, 0.92f, 1.06f), 1800)
                sparkles.forEachIndexed { i, s -> loop(ObjectAnimator.ofFloat(s, View.ALPHA, 0.25f, 1f).apply { startDelay = i * 300L }, 900L + i * 250) }
                loop(ObjectAnimator.ofFloat(mystery, View.SCALE_X, 1f, 1.12f), 800)
                loop(ObjectAnimator.ofFloat(mystery, View.SCALE_Y, 1f, 1.12f), 800)
            }
            true
        } catch (_: RuntimeException) { root = null; false }
    }

    private fun loop(a: ObjectAnimator, ms: Long) {
        a.duration = ms; a.repeatCount = ValueAnimator.INFINITE; a.repeatMode = ValueAnimator.REVERSE
        a.interpolator = AccelerateDecelerateInterpolator(); a.start(); animators += a
    }
    private fun loop(a: ObjectAnimator, ms: Int) = loop(a, ms.toLong())

    fun hide() {
        animators.forEach { it.cancel() }; animators.clear()
        root?.let { v -> runCatching { wm.removeViewImmediate(v) } }
        root = null
    }
}
