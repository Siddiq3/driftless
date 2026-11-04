package app.driftless.tracking.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetFaceTest {
    @Test fun unknownOrInactiveCountsClaimNoMoodOrAllowance() {
        assertEquals(WidgetFace(WidgetFace.Pose.RESTING, null, null), WidgetFace.of(null, 20, true, null))
        assertEquals(WidgetFace(WidgetFace.Pose.RESTING, null, "🔥 3-day streak"), WidgetFace.of(5, 20, false, 3))
    }

    @Test fun showsRemainingAllowanceAgainstTheSmallestVideoGoal() {
        val face = WidgetFace.of(5, 20, true, null)
        assertEquals(WidgetFace.Pose.FRESH, face.pose)
        assertEquals("15 left of 20 today", face.goalText)
        assertNull(face.streakText)
    }

    @Test fun limitReachedMakesTheCompanionDrained() {
        assertEquals(WidgetFace(WidgetFace.Pose.DRAINED, "Daily limit reached", null), WidgetFace.of(20, 20, true, 0))
        assertEquals(WidgetFace.Pose.DRAINED, WidgetFace.of(31, 20, true, 9).pose)
    }

    @Test fun longStreakWellUnderTheLimitLooksFocused() {
        assertEquals(WidgetFace.Pose.FOCUSED, WidgetFace.of(4, 20, true, 7).pose)
        // Near the limit the companion stops looking focused even on a long streak.
        assertEquals(WidgetFace.Pose.FRESH, WidgetFace.of(16, 20, true, 7).pose)
    }

    @Test fun noGoalStillShowsCountMoodAndStreak() {
        assertEquals(WidgetFace(WidgetFace.Pose.FRESH, null, "🔥 1-day streak"), WidgetFace.of(9, null, true, 1))
    }
}
