package app.driftless.tracking.android

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ScrollView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w375dp-h720dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WrapReadyOverlayTest {
    private fun root(overlay: WrapReadyOverlay) = WrapReadyOverlay::class.java.getDeclaredField("root")
        .apply { isAccessible = true }.get(overlay) as ScrollView
    private fun buttons(view: View): List<Button> = when (view) {
        is Button -> listOf(view)
        is ViewGroup -> (0 until view.childCount).flatMap { buttons(view.getChildAt(it)) }
        else -> emptyList()
    }
    @Test fun oneCardAtATimeDismissesAndOpeningIsExplicit() {
        val controller = Robolectric.buildService(MemeTestService::class.java).create()
        val overlay = WrapReadyOverlay(controller.get())
        var opened = 0
        try {
            assertTrue(overlay.show(ReadyWrap("daily", "2026-10-26")) { opened++ })
            assertFalse(overlay.show(ReadyWrap("weekly", "2026-10-25")) {})
            buttons(root(overlay)).single { it.text == "Keep watching" }.performClick()
            assertFalse(overlay.isShowing); assertEquals(0, opened)
            assertTrue(overlay.show(ReadyWrap("weekly", "2026-10-25")) { opened++ })
            buttons(root(overlay)).single { it.text == "See my Wrapped" }.performClick()
            assertEquals(1, opened); assertFalse(overlay.isShowing)
        } finally { overlay.hide(); controller.destroy() }
    }
    private fun render(label: String, fontScale: Float = 1f) {
        val controller = Robolectric.buildService(MemeTestService::class.java).create()
        val resources = controller.get().resources
        val configuration = android.content.res.Configuration(resources.configuration).apply { this.fontScale = fontScale }
        @Suppress("DEPRECATION")
        resources.updateConfiguration(configuration, resources.displayMetrics)
        val overlay = WrapReadyOverlay(controller.get())
        try {
            assertTrue(overlay.show(ReadyWrap("weekly", "2026-10-25")) {})
            val view = root(overlay)
            val metrics = controller.get().resources.displayMetrics
            val width = minOf((360 * metrics.density).toInt(), metrics.widthPixels - (32 * metrics.density).toInt())
            view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(metrics.heightPixels, View.MeasureSpec.AT_MOST))
            view.layout(0, 0, width, view.measuredHeight)
            assertTrue(view.measuredHeight <= metrics.heightPixels - (80 * metrics.density).toInt())
            buttons(view).forEach { assertTrue(it.measuredHeight >= (48 * metrics.density).toInt()) }
            if (label == "landscape") assertTrue(view.getChildAt(0).height <= view.height)
            view.fullScroll(View.FOCUS_DOWN)
            assertTrue(view.scrollY + view.height >= view.getChildAt(0).height)
            System.getenv("WRAP_RENDER_DIR")?.let { directory ->
                val bitmap = Bitmap.createBitmap(width, view.measuredHeight, Bitmap.Config.ARGB_8888)
                view.draw(Canvas(bitmap))
                File(directory).mkdirs()
                File(directory, "wrap-ready-$label.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
            }
        } finally { overlay.hide(); controller.destroy() }
    }
    @Test fun smallPhoneCardRendersWithReachableActions() { render("portrait") }
    @Test @Config(qualifiers = "w720dp-h375dp-land")
    fun landscapeCardScrollsToKeepBothActionsAvailable() { render("landscape") }
    @Test @Config(qualifiers = "w375dp-h720dp")
    fun largeTextCardScrollsWithoutClippingActions() { render("large-text", 1.5f) }
}
