package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class BundledVideoTest {
    @Test fun canSwitchBetweenOnboardingAndAccessibilityWithoutConfusingTheContent() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val video=GuideVideoPlayer(context)
        video.playing=false
        assertTrue(video.contentDescription.toString().contains("Downloaded apps"))
        video.setSource("reels")
        assertTrue(video.contentDescription.toString().contains("six Reels"))
        video.setSource("accessibility")
        assertTrue(video.contentDescription.toString().contains("Downloaded apps"))
    }
    @Test fun onlyBundledVideosAreAccepted() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val video=GuideVideoPlayer(context)
        assertThrows(IllegalArgumentException::class.java) {video.setSource("https://example.com/video.mp4")}
    }
}
