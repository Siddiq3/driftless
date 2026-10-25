package app.driftless.tracking.android

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Movie
import android.os.SystemClock
import android.os.Build
import android.view.View

/** Bundled GIF playback: no WebView, network request, audio or third-party SDK. */
@Suppress("DEPRECATION")
class MemeGifView(context: Context, asset: String) : View(context) {
    private val movie = context.assets.open(asset).use { Movie.decodeStream(it) }
    private val started = SystemClock.uptimeMillis()

    init { setLayerType(LAYER_TYPE_SOFTWARE, null) }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val gif = movie ?: return
        if (gif.width() <= 0 || gif.height() <= 0) return
        val animate = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
        gif.setTime(if (animate) ((SystemClock.uptimeMillis() - started) % gif.duration().coerceAtLeast(1)).toInt() else 0)
        val scale = minOf(width.toFloat() / gif.width(), height.toFloat() / gif.height())
        val save = canvas.save()
        canvas.translate((width - gif.width() * scale) / 2f, (height - gif.height() * scale) / 2f)
        canvas.scale(scale, scale)
        gif.draw(canvas, 0f, 0f)
        canvas.restoreToCount(save)
        if (animate && isAttachedToWindow && isShown) postInvalidateDelayed(33L)
    }
}
