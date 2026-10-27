package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.driftless.tracking.R
import app.driftless.tracking.core.CountBadgeValue
import app.driftless.tracking.core.CountBadgeMood
import app.driftless.tracking.core.memeCopy
import app.driftless.tracking.core.MemeCollection

/** Dismissible, local-only break card over the recognized player. Never touches the player itself. */
class MemeMilestoneCard(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var root: FrameLayout? = null
    private val prefs = TrackingPrefs(service)
    private val availableMemes by lazy {
        val assets = service.assets.list("memes")?.toSet().orEmpty()
        MemeCollection.all.filter { "${it.id}.gif" in assets }
    }
    val isShowing get() = root != null
    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()
    private fun rounded(top: String, bottom: String = top, radius: Int = 28) = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(Color.parseColor(top), Color.parseColor(bottom))
    ).apply { cornerRadius = dp(radius).toFloat() }

    fun show(value: CountBadgeValue, milestone: Int, language: String, shorts: Boolean = false, onBreak: () -> Unit): Boolean {
        if (isShowing) return false
        val reaction = MemeCollection.choose(availableMemes, prefs.usedMemeReactions(), prefs.lastMemeReaction())
            ?: return false
        val captionIndex = MemeCollection.captionIndex(reaction, prefs.previousMemeCaption(reaction.id))
        val copy = memeCopy(language, milestone)
        val backdrop = FrameLayout(service).apply {
            setBackgroundColor(Color.parseColor("#B5000000"))
            setOnClickListener { hide() }
        }
        val column = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(16),dp(12),dp(16),dp(20))
            background = rounded("#12100F", "#060605", 32).apply { setStroke(dp(1),Color.parseColor("#51402A")) }
            // Absorb card taps; only the outside backdrop dismisses.
            setOnClickListener { }
        }
        val header = LinearLayout(service).apply { gravity=Gravity.CENTER_VERTICAL }
        val pill = LinearLayout(service).apply {
            minimumHeight=dp(48)
            gravity=Gravity.CENTER; setPadding(dp(12),dp(4),dp(12),dp(4))
            background=rounded("#682C25",radius=24)
        }
        pill.addView(ImageView(service).apply {
            setImageResource(if(value.mood == CountBadgeMood.DRAINED) R.drawable.scrollsnooze_drained else R.drawable.scrollsnooze_fresh)
            importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(dp(36),dp(36)))
        pill.addView(TextView(service).apply {
            text=value.text; textSize=20f; setTextColor(Color.parseColor("#FF6F75")); typeface=Typeface.DEFAULT_BOLD
            setPadding(dp(6),0,0,0); contentDescription="${value.text} · ${value.status}"
        }, LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        header.addView(pill,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        header.addView(Button(service).apply {
            text="×"; textSize=24f; isAllCaps=false; contentDescription=copy.close
            setTextColor(Color.parseColor("#FFE8B0")); background=rounded("#28241E",radius=24)
            setOnClickListener { hide() }
        },LinearLayout.LayoutParams(dp(48),dp(48)).apply { leftMargin=dp(12) })
        column.addView(header,LinearLayout.LayoutParams(-1,-2))
        val artwork=MemeGifView(service, "memes/${reaction.id}.gif").apply {
            background=rounded("#28241E",radius=20)
            clipToOutline=true; contentDescription=reaction.description
        }
        val heightDp=service.resources.displayMetrics.heightPixels/service.resources.displayMetrics.density
        column.addView(artwork,LinearLayout.LayoutParams(-1,dp(if(heightDp < 650) 140 else 210)).apply {topMargin=dp(12)})
        column.addView(TextView(service).apply {
            text=reaction.caption(captionIndex, milestone, shorts); textSize=20f; gravity=Gravity.CENTER; typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#FFFAED")); setPadding(dp(4),dp(20),dp(4),dp(12))
        },LinearLayout.LayoutParams(-1,-2))
        column.addView(TextView(service).apply {
            text="GIF via Tenor"; textSize=11f; gravity=Gravity.CENTER
            setTextColor(Color.parseColor("#C7BDAA"))
        },LinearLayout.LayoutParams(-1,-2))
        fun action(label: String, primary: Boolean, click: () -> Unit) = Button(service).apply {
            text=label; textSize=16f; isAllCaps=false; typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor(if(primary) "#603500" else "#FFFAED"))
            background=if(primary) rounded("#FFE9AE","#FFB569") else rounded("#2B2820")
            minHeight=dp(52); setOnClickListener { hide(); click() }
        }
        column.addView(action(copy.pause,true,onBreak),LinearLayout.LayoutParams(-1,-2).apply {topMargin=dp(12)})
        column.addView(action(copy.continueWatching,false) {},LinearLayout.LayoutParams(-1,-2).apply {topMargin=dp(10)})
        val scroller=ScrollView(service).apply { isFillViewport=false; addView(column) }
        val width=minOf(dp(360), service.resources.displayMetrics.widthPixels-dp(32))
        backdrop.addView(scroller,FrameLayout.LayoutParams(width,-2,Gravity.CENTER).apply {
            topMargin=dp(12); bottomMargin=dp(12)
        })
        val params=WindowManager.LayoutParams(-1,-1,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT).apply {
            gravity=Gravity.CENTER; title="ScrollSnooze reel break"
        }
        return try {
            wm.addView(backdrop,params); root=backdrop
            prefs.rememberMemeReaction(reaction.id, captionIndex, availableMemes.map { it.id }.toSet())
            if(Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()) {
                column.alpha=0f; column.translationY=dp(20).toFloat(); column.scaleX=0.94f; column.scaleY=0.94f
                column.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f).setDuration(280).start()
            }
            true
        } catch (_: RuntimeException) { false }
    }

    fun hide() {
        root?.animate()?.cancel()
        root?.let { runCatching { wm.removeViewImmediate(it) } }
        root=null
    }
}
