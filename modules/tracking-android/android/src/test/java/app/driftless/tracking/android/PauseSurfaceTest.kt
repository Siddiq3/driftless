package app.driftless.tracking.android

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PauseSurfaceTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()

    @Test fun countdownUpdatesInPlaceAndThePrimaryActionStaysUsable() {
        val surface = PauseSurface(context)
        surface.present("Take a breath.", "Soon.", "1:00", "left in this break")
        var calls = 0
        val action = surface.action("Leave feed", true) { calls++ }
        assertEquals(View.VISIBLE, surface.figure.visibility)
        surface.present("Take a breath.", "Soon.", "0:59", "left in this break")
        assertEquals("0:59", surface.figure.text.toString())
        action.performClick()
        assertEquals(1, calls)
        assertTrue(action.minimumHeight >= (48 * context.resources.displayMetrics.density).toInt())
    }
    @Test fun aPauseWithoutANumberHidesTheFigureAndKeepsTheFooter() {
        val surface = PauseSurface(context)
        surface.present("Focus time.", "The feed can wait.")
        assertEquals(View.GONE, surface.figure.visibility)
        assertEquals(View.GONE, surface.figureLabel.visibility)
        assertTrue(views(surface).filterIsInstance<TextView>().any { it.text.contains("Back and Home") })
    }
}
