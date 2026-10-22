package app.driftless.tracking.android

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.os.Build
import android.widget.ImageView
import app.driftless.tracking.core.CountBadgeMood

/** Eyelids are drawn in artwork coordinates so blinking follows the image at every badge size. */
class BlinkingBrainView(context: Context) : ImageView(context) {
    private var mood = CountBadgeMood.HAPPY
    private var animator: ValueAnimator? = null
    private var scheduled = false
    private var interval = 0
    internal var blinkProgress = 0f
        private set
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val eyePath = Path()
    private val lidPath = Path()
    private val blink = Runnable {
        scheduled = false
        if (isAttachedToWindow && motionEnabled() && mood != CountBadgeMood.UNKNOWN) {
            animator = ValueAnimator.ofFloat(0f, 1f, 0f).apply {
                duration = if (mood == CountBadgeMood.DRAINED) 360L else 220L
                addUpdateListener {
                    blinkProgress = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
            scheduleBlink()
        }
    }
    private fun motionEnabled() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    fun setMood(next: CountBadgeMood) {
        if (mood != next || !motionEnabled()) {
            stopBlinking()
            mood = next
        }
        scheduleBlink()
    }
    private fun scheduleBlink() {
        if (scheduled || !isAttachedToWindow || !motionEnabled() || mood == CountBadgeMood.UNKNOWN) return
        scheduled = true
        // Alternate the quiet interval to avoid a mechanical, metronomic blink.
        val delay = if (mood == CountBadgeMood.DRAINED) 3800L else 2800L
        postDelayed(blink, delay + (interval++ % 3) * 650L)
    }
    private fun stopBlinking() {
        removeCallbacks(blink); scheduled = false; interval = 0
        animator?.cancel(); animator = null
        blinkProgress = 0f
        invalidate()
    }
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        scheduleBlink()
    }
    override fun onDetachedFromWindow() {
        stopBlinking()
        super.onDetachedFromWindow()
    }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (blinkProgress <= 0f) return
        val art = drawable ?: return
        val save = canvas.save()
        canvas.translate(paddingLeft.toFloat(), paddingTop.toFloat())
        canvas.concat(imageMatrix)
        canvas.scale(art.intrinsicWidth / 384f, art.intrinsicHeight / 384f)
        // ScrollSnooze 1254px masters, with eye bounds normalized to the 384-unit canvas.
        if (mood == CountBadgeMood.DRAINED) {
            eyelid(canvas, 131f, 198f, 181f, 221f, -10f)
            eyelid(canvas, 220f, 187f, 273f, 209f, -4f)
            // A restrained frown follows the heavy blink; happy never gets a drained mouth.
            paint.style = Paint.Style.FILL
            paint.color = Color.rgb(196, 160, 255)
            paint.alpha = (255 * blinkProgress).toInt()
            canvas.drawOval(190f, 210f, 216f, 227f, paint)
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 3f
            paint.strokeCap = Paint.Cap.ROUND
            paint.color = Color.rgb(36, 22, 66)
            paint.alpha = (255 * blinkProgress).toInt()
            lidPath.reset()
            lidPath.moveTo(195f, 220f)
            lidPath.quadTo(203f, 208f - 3f * blinkProgress, 211f, 220f)
            canvas.drawPath(lidPath, paint)
            paint.alpha = 255
        } else {
            eyelid(canvas, 132f, 168f, 181f, 213f, -8f)
            eyelid(canvas, 223f, 156f, 270f, 199f, -7f)
        }
        canvas.restoreToCount(save)
    }
    private fun eyelid(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, tilt: Float) {
        val width = right - left
        val height = bottom - top
        val save = canvas.save()
        // Follow the curved eye opening, leaving the surrounding brain texture untouched.
        eyePath.reset()
        eyePath.moveTo(left, bottom)
        eyePath.cubicTo(left - 5, top + height * .25f, right - width * .3f, top - 10, right, top + height * .35f)
        eyePath.cubicTo(right + 5, bottom - 3, right - width * .2f, bottom + 3, left, bottom)
        eyePath.close()
        canvas.clipPath(eyePath)
        val edge = top + (height + kotlin.math.abs(tilt) + 8f) * blinkProgress
        paint.style = Paint.Style.FILL
        paint.shader = LinearGradient(left, top, right, bottom,
            Color.rgb(196, 160, 255), Color.rgb(216, 153, 239), Shader.TileMode.CLAMP)
        lidPath.reset()
        lidPath.moveTo(left - 8, top - 12)
        lidPath.lineTo(right + 8, top - 12)
        lidPath.lineTo(right + 8, edge + tilt)
        lidPath.quadTo(left + width * .5f, edge + 7, left - 8, edge)
        lidPath.close()
        canvas.drawPath(lidPath, paint)
        paint.shader = null
        paint.color = Color.rgb(36, 22, 66)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2.4f
        lidPath.reset()
        lidPath.moveTo(left - 8, edge)
        lidPath.quadTo(left + width * .5f, edge + 7, right + 8, edge + tilt)
        canvas.drawPath(lidPath, paint)
        canvas.restoreToCount(save)
    }
}
