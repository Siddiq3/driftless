package app.driftless.tracking.core

import kotlin.random.Random
import org.junit.Assert.*
import org.junit.Test

class MemeCollectionTest {
    @Test fun firstCountUsesGreetingInsteadOfHighCountRoast() {
        MemeCollection.all.forEach { meme ->
            meme.captions.indices.forEach { index ->
                val text=meme.caption(index,1,false)
                assertTrue(text.contains("1"))
                assertNotEquals(text,meme.caption(index,50,false))
                assertNotEquals(text,meme.caption(index,1,true))
            }
        }
    }
    @Test fun collectionHasTwentyDistinctReactionsAndNativeScriptCopy() {
        assertEquals(20, MemeCollection.all.size)
        assertEquals(20, MemeCollection.all.map { it.id }.toSet().size)
        val scripts = mapOf("te" to '\u0C00'..'\u0C7F', "hi" to '\u0900'..'\u097F',
            "ta" to '\u0B80'..'\u0BFF', "ml" to '\u0D00'..'\u0D7F')
        MemeCollection.all.forEach { meme ->
            assertTrue(meme.captions.size >= 3)
            meme.captions.indices.forEach { index ->
                val text = meme.caption(index, 150, true)
                assertTrue(text.contains("150"))
                assertFalse(text.contains("{"))
                scripts[meme.language]?.let { script -> assertTrue(text.any { it in script }) }
                assertNotEquals(text, meme.caption(index, 200, false))
            }
        }
    }

    @Test fun randomRotationUsesEveryMemeBeforeRepeatingAndDoesNotFixMemeToCount() {
        val random = Random(42)
        val used = mutableSetOf<String>()
        var last: String? = null
        repeat(MemeCollection.all.size) {
            val next = MemeCollection.choose(MemeCollection.all, used, last, random)!!
            assertTrue(used.add(next.id))
            last = next.id
        }
        assertNotEquals(last, MemeCollection.choose(MemeCollection.all, used, last, random)!!.id)
        assertTrue((1..30).map {
            MemeCollection.choose(MemeCollection.all, emptySet(), null, random)!!.id
        }.toSet().size > 1)
    }

    @Test fun repeatedReactionChangesCaptionAndEmptyOrSingletonPoolsAreSafe() {
        val random = Random(7)
        MemeCollection.all.forEach { meme ->
            var previous = -1
            repeat(20) {
                val next = MemeCollection.captionIndex(meme, previous, random)
                assertNotEquals(previous, next)
                previous = next
            }
        }
        assertNull(MemeCollection.choose(emptyList(), emptySet(), null, random))
        val meme = MemeCollection.all.first()
        assertEquals(meme, MemeCollection.choose(listOf(meme), setOf(meme.id), meme.id, random))
    }
}
