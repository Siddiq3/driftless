package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class BadgeStateTest {
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
    @Test fun unconfirmedAndMissingIdentityAreNeverPresentedAsConfirmed() {
        assertEquals(CountBadgeValue("7","Today"),countBadgeValue(7,true,true))
        assertEquals(CountBadgeValue("~7","Unconfirmed"),countBadgeValue(7,false,true))
        assertEquals(CountBadgeValue("—","Not detected",CountBadgeMood.UNKNOWN),countBadgeValue(7,false,false))
        assertEquals(CountBadgeValue("—","Not detected",CountBadgeMood.UNKNOWN),countBadgeValue(7,true,false))
        assertEquals("0",countBadgeValue(-1,true,true).text)
    }
    @Test fun happyThroughTheLimitAndDrainedOnlyAboveIt() {
        for (limit in listOf(25,50,100,150)) {
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(0,true,true,limit).mood)
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(limit-1,true,true,limit).mood)
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(limit,true,true,limit).mood)
            assertEquals(CountBadgeMood.DRAINED, countBadgeValue(limit+1,true,true,limit).mood)
            assertEquals(CountBadgeMood.HAPPY, countBadgeValue(0,true,true,limit).mood)
        }
    }
    @Test fun moodDoesNotCertifyUnvalidatedCountsOrGuessMissingIdentity() {
        assertEquals(CountBadgeValue("~101","Unconfirmed",CountBadgeMood.DRAINED),countBadgeValue(101,false,true,100))
        assertEquals(CountBadgeMood.UNKNOWN,countBadgeValue(101,true,false,100).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,null).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,0).mood)
        assertEquals(CountBadgeMood.HAPPY,countBadgeValue(101,true,true,150).mood)
    }
}
