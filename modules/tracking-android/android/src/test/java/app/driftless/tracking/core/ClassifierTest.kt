package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ClassifierTest {
    private val rules = AppRules(
        pkg = "com.example.video",
        label = "Example",
        surfaceViewIds = setOf("pager"),
        itemParts = listOf(ItemPart("video", Field.CONTENT_DESC), ItemPart("author", Field.TEXT)),
        adViewIds = setOf("ad_badge"),
        adLabels = setOf("sponsored"),
        validatedVersions = listOf("400.1"),
    )
    private val salt = ByteArray(16) { 7 }
    private val c = Classifier()

    private fun screen(desc: String?, author: String?, vararg extra: FakeNode) = FakeNode(
        viewId = "root",
        children = listOf(
            FakeNode(
                viewId = "pager",
                children = listOf(FakeNode(viewId = "video", contentDesc = desc), FakeNode(viewId = "author", text = author)) + extra,
            ),
        ),
    )

    @Test fun recognisesSurfaceAndFingerprintsItem() {
        val r = c.classify(screen("Video one", "@a"), rules, salt)
        assertEquals(Surface.SHORT_VIDEO, r.surface)
        assertNotNull(r.fingerprint)
        assertFalse(r.isAd)
    }

    @Test fun differentItemsGetDifferentFingerprints() {
        val a = c.classify(screen("Video one", "@a"), rules, salt).fingerprint
        val b = c.classify(screen("Video two", "@a"), rules, salt).fingerprint
        assertNotEquals(a, b)
        assertEquals(a, c.classify(screen("Video one", "@a"), rules, salt).fingerprint)
    }

    @Test fun missingAnyItemPartMeansUnknownContent() {
        val r = c.classify(screen("Video one", null), rules, salt)
        assertEquals(Surface.SHORT_VIDEO, r.surface)
        assertNull(r.fingerprint)
    }

    @Test fun nonShortVideoScreenIsOther() {
        val home = FakeNode(viewId = "feed", children = listOf(FakeNode(viewId = "video", contentDesc = "x")))
        assertEquals(Surface.OTHER, c.classify(home, rules, salt).surface)
    }

    @Test fun nullRootIsUnknown() {
        assertEquals(Surface.UNKNOWN, c.classify(null, rules, salt).surface)
    }

    @Test fun detectsAdsByIdOrLabel() {
        assertTrue(c.classify(screen("v", "@a", FakeNode(viewId = "ad_badge")), rules, salt).isAd)
        assertTrue(c.classify(screen("v", "@a", FakeNode(text = " Sponsored ")), rules, salt).isAd)
        assertFalse(c.classify(screen("v", "@a", FakeNode(text = "Sponsored by my friend's caption")), rules, salt).isAd)
    }

    @Test fun ignoresInvisibleNodes() {
        val hidden = FakeNode(viewId = "root", children = listOf(FakeNode(viewId = "pager", isVisible = false)))
        assertEquals(Surface.OTHER, c.classify(hidden, rules, salt).surface)
    }

    @Test fun traversalIsBounded() {
        var deep = FakeNode(viewId = "leaf")
        repeat(5_000) { deep = FakeNode(children = listOf(deep)) }
        val r = Classifier(maxNodes = 600, maxDepth = 40).classify(deep, rules, salt)
        assertTrue(r.nodesVisited <= 600)
    }

    @Test fun versionGate() {
        assertTrue(isValidatedVersion(rules, "400.1"))
        assertTrue(isValidatedVersion(rules, "400.1.2"))
        assertFalse(isValidatedVersion(rules, "400.10"))
        assertFalse(isValidatedVersion(rules, null))
    }
}
