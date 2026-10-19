package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.DialogInterface
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.accessibility.AccessibilityEvent
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import app.driftless.tracking.core.CountBadgeValue
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class FloatingCountBadgeTest {
    class BadgeService : AccessibilityService() {
        override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
        override fun onInterrupt() {}
    }
    @Test fun longPressMovesBadgeAndBottomDropOffersPause() {
        val controller = Robolectric.buildService(BadgeService::class.java).create()
        val service = controller.get()
        service.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE).edit().clear().commit()
        val badge = FloatingCountBadge(service)
        badge.show(CountBadgeValue("12", "Today"))
        shadowOf(Looper.getMainLooper()).idle()
        val field = FloatingCountBadge::class.java.getDeclaredField("root").apply { isAccessible = true }
        val root = field.get(badge) as LinearLayout
        root.layout(0, 0, 80, 160)
        fun fieldValue(name: String): Any? = FloatingCountBadge::class.java.getDeclaredField(name)
            .apply { isAccessible = true }.get(badge)
        assertNull(fieldValue("dismissTarget"))
        assertEquals(2, root.childCount)
        var down = SystemClock.uptimeMillis()
        fun touch(action: Int, x: Float, y: Float) {
            val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0)
            root.dispatchTouchEvent(event)
            event.recycle()
        }
        touch(MotionEvent.ACTION_DOWN, 30f, 80f)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(ViewConfiguration.getLongPressTimeout().toLong() + 100))
        assertNotNull(fieldValue("dismissTarget"))
        touch(MotionEvent.ACTION_MOVE, 80f, 220f)
        touch(MotionEvent.ACTION_UP, 80f, 220f)
        assertTrue(TrackingPrefs(service).badgeY > 0f)
        assertNull(fieldValue("dismissTarget"))
        TrackingPrefs(service).floatingCountSize = 72
        badge.show(CountBadgeValue("13", "Today"))
        val image = root.getChildAt(0) as ImageView
        assertEquals((72 * service.resources.displayMetrics.density).toInt(), image.layoutParams.width)
        fun dropOnTarget() {
            down = SystemClock.uptimeMillis()
            val start = fieldValue("params") as WindowManager.LayoutParams
            val startX = start.x; val startY = start.y
            touch(MotionEvent.ACTION_DOWN, 30f, 40f)
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(ViewConfiguration.getLongPressTimeout().toLong() + 100))
            val target = fieldValue("dismissParams") as WindowManager.LayoutParams
            val x = target.x + target.width / 2f - root.width / 2f - startX + 30f
            val y = target.y + target.height / 2f - root.height / 2f - startY + 40f
            touch(MotionEvent.ACTION_MOVE, x, y)
            touch(MotionEvent.ACTION_UP, x, y)
            assertNull(fieldValue("dismissTarget"))
        }
        val savedX = TrackingPrefs(service).badgeX
        val savedY = TrackingPrefs(service).badgeY
        dropOnTarget()
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertTrue(dialog.isShowing)
        dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0L, TrackingPrefs(service).floatingCountPausedUntil)
        assertEquals(savedX, TrackingPrefs(service).badgeX, 0.001f)
        assertEquals(savedY, TrackingPrefs(service).badgeY, 0.001f)
        dropOnTarget()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        val remaining = TrackingPrefs(service).floatingCountPausedUntil - System.currentTimeMillis()
        assertTrue(remaining in 3_599_000L..3_600_000L)
        assertNull(field.get(badge))
        assertNull("Dragging and dropping must not open the app", shadowOf(service).nextStartedActivity)
        controller.destroy()
    }
    @Test fun eyesBlinkWithoutChangingCountAndStopWhenHidden() {
        val controller = Robolectric.buildService(BadgeService::class.java).create()
        val badge = FloatingCountBadge(controller.get())
        badge.show(CountBadgeValue("12", "Today"))
        val root = FloatingCountBadge::class.java.getDeclaredField("root")
            .apply { isAccessible = true }.get(badge) as LinearLayout
        val brain = root.getChildAt(0) as BlinkingBrainView
        val count = root.getChildAt(1) as android.widget.TextView
        val looper = shadowOf(Looper.getMainLooper())
        looper.idle()
        fun startBlink(): android.animation.ValueAnimator {
            val callback = BlinkingBrainView::class.java.getDeclaredField("blink")
                .apply { isAccessible = true }.get(brain) as Runnable
            brain.removeCallbacks(callback)
            callback.run()
            return BlinkingBrainView::class.java.getDeclaredField("animator")
                .apply { isAccessible = true }.get(brain) as android.animation.ValueAnimator
        }
        val happyBlink = startBlink()
        happyBlink.setCurrentFraction(.5f)
        assertTrue("Eyelids should close during the blink", brain.blinkProgress > 0f)
        assertEquals("12", count.text.toString())
        happyBlink.end()
        assertEquals(0f, brain.blinkProgress, .001f)
        badge.show(CountBadgeValue("13", "Today", app.driftless.tracking.core.CountBadgeMood.DRAINED))
        val drainedBlink = startBlink()
        assertTrue(drainedBlink.duration > happyBlink.duration)
        drainedBlink.setCurrentFraction(.5f)
        assertTrue("Drained eyes also blink", brain.blinkProgress > 0f)
        badge.hide()
        assertEquals(0f, brain.blinkProgress, .001f)
        looper.idleFor(Duration.ofSeconds(6))
        assertEquals(0f, brain.blinkProgress, .001f)
        controller.destroy()
    }

    @Test fun tappingCounterOpensAppAndAccessibilityClickWorks() {
        val controller = Robolectric.buildService(BadgeService::class.java).create()
        val service = controller.get()
        val launcher = android.content.Intent(android.content.Intent.ACTION_MAIN)
            .addCategory(android.content.Intent.CATEGORY_LAUNCHER).setPackage(service.packageName)
        val resolve = android.content.pm.ResolveInfo().apply {
            activityInfo = android.content.pm.ActivityInfo().apply {
                packageName = service.packageName
                name = "${service.packageName}.MainActivity"
            }
        }
        shadowOf(service.packageManager).addResolveInfoForIntent(launcher, resolve)
        val badge = FloatingCountBadge(service)
        badge.show(CountBadgeValue("12", "Today"))
        shadowOf(Looper.getMainLooper()).idle()
        val root = FloatingCountBadge::class.java.getDeclaredField("root")
            .apply { isAccessible = true }.get(badge) as LinearLayout
        root.layout(0, 0, 80, 120)
        val down = SystemClock.uptimeMillis()
        for (action in listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP)) {
            val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, 30f, 30f, 0)
            root.dispatchTouchEvent(event)
            event.recycle()
        }
        val launched = shadowOf(service).nextStartedActivity
        assertNotNull(launched)
        assertEquals(resolve.activityInfo.name, launched.component?.className)
        assertTrue(launched.flags and android.content.Intent.FLAG_ACTIVITY_NEW_TASK != 0)
        assertNull(shadowOf(service).nextStartedActivity)
        assertTrue(root.performClick())
        assertNotNull(shadowOf(service).nextStartedActivity)
        badge.hide()
        controller.destroy()
    }

}
