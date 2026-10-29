package app.driftless.tracking.android

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.Button
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

    @Test fun expandedDetailsSurviveCountdownUpdatesWithoutLosingThePrimaryAction() {
        val surface = PauseSurface(context)
        surface.present("A moment to reset", "Breathe. You’re here.", "1:00 left", "Time away still counts.")
        var calls = 0
        val action = surface.action("Leave feed", true) { calls++ }
        val toggle = views(surface).filterIsInstance<Button>().single { it.text.startsWith("Pause details") }
        val explanation = views(surface).filterIsInstance<TextView>().single { it.text.toString() == "Time away still counts." }
        assertEquals(View.GONE, explanation.visibility)
        toggle.performClick()
        assertEquals(View.VISIBLE, explanation.visibility)
        surface.present("A moment to reset", "Breathe. You’re here.", "0:59 left", "Time away still counts.")
        assertEquals(View.VISIBLE, explanation.visibility)
        assertTrue(surface.summary.text.contains("0:59"))
        action.performClick()
        assertEquals(1, calls)
        assertTrue(action.minimumHeight >= (48 * context.resources.displayMetrics.density).toInt())
        toggle.performClick()
        assertEquals(View.GONE, explanation.visibility)
    }
}
