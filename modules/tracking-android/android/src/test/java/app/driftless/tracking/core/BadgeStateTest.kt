package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class BadgeStateTest {
    @Test fun accountLongTotalsAndUnavailableMeasurementsAreNotDisplayedAsZero() {
        assertEquals("42",countBadgeValue(42L,false,true,50).text)
        assertEquals(CountBadgeMood.DRAINED,countBadgeValue(50L,false,true,50).mood)
        assertEquals(CountBadgeValue("—","Usage unavailable",CountBadgeMood.UNKNOWN),countBadgeValue(null,false,true,50))
        assertEquals("0",countBadgeValue(0L,false,true,50).text)
    }
    @Test fun visibleOnlyForAnEnabledConsentedUnlockedShortVideo() {
        assertTrue(showCountBadge(true,true,true,false,true,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(false,true,true,false,true,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(true,false,true,false,true,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(true,true,false,false,true,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(true,true,true,true,true,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(true,true,true,false,false,Surface.SHORT_VIDEO))
        assertFalse(showCountBadge(true,true,true,false,true,Surface.OTHER))
        assertFalse(showCountBadge(true,true,true,false,true,Surface.UNKNOWN))
    }
    @Test fun savedCountStaysVisibleWhileNextVideoIsBeingIdentified() {
        assertEquals(CountBadgeValue("7","Today"),countBadgeValue(7,true,true))
        assertEquals(CountBadgeValue("7","On this phone"),countBadgeValue(7,false,true))
        assertEquals(CountBadgeValue("7","Not detected",CountBadgeMood.HAPPY),countBadgeValue(7,false,false))
        assertEquals(CountBadgeValue("7","Not detected",CountBadgeMood.HAPPY),countBadgeValue(7,true,false))
        assertEquals("0",countBadgeValue(-1,true,true).text)
    }
    @Test fun drainedAtTheExactEnforcedLimit() {
        for (limit in listOf(25,50,100,150)) {
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(0,true,true,limit).mood)
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(limit-1,true,true,limit).mood)
            assertEquals(CountBadgeMood.DRAINED, countBadgeValue(limit,true,true,limit).mood)
            assertEquals(CountBadgeMood.DRAINED, countBadgeValue(limit+1,true,true,limit).mood)
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(0,true,true,limit).mood)
        }
    }
    @Test fun moodReflectsSavedCountEvenWhileIdentityIsPending() {
        assertEquals(CountBadgeValue("101","On this phone",CountBadgeMood.DRAINED),countBadgeValue(101,false,true,100))
        assertEquals(CountBadgeMood.DRAINED,countBadgeValue(101,true,false,100).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,null).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,0).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,150).mood)
    }
    @Test fun reelTransitionOnlyChangesNumberWhenSavedCountChanges() {
        val first = countBadgeValue(1, false, true, 100)
        val loadingNext = countBadgeValue(1, false, false, 100)
        val nextCounted = countBadgeValue(2, false, true, 100)
        assertEquals("1", first.text)
        assertEquals(first.text, loadingNext.text)
        assertEquals(first.mood, loadingNext.mood)
        assertEquals("2", nextCounted.text)
        assertEquals("0", countBadgeValue(0, false, false).text)
    }

}
