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
    @Test fun languagePoolCyclesWithinTheRequestedLanguageAndFallsBackWhenAssetsAreMissing() {
        val telugu=MemeCollection.poolForLanguage(MemeCollection.all,"te")
        assertTrue(telugu.all {it.language=="te"})
        val used=mutableSetOf<String>();var last:String?=null
        repeat(telugu.size) {
            val next=MemeCollection.choose(telugu,used,last,Random(it))!!
            assertTrue(used.add(next.id));last=next.id
        }
        assertNotEquals(last,MemeCollection.choose(telugu,used,last,Random(2))!!.id)
        assertEquals(MemeCollection.all,MemeCollection.poolForLanguage(MemeCollection.all,"kn"))
        assertTrue(MemeCollection.poolForLanguage(emptyList(),"te").isEmpty())
        val single=MemeCollection.poolForLanguage(MemeCollection.all,"ml")
        assertEquals(1,single.size)
        assertEquals(single.single(),MemeCollection.choose(single,setOf(single.single().id),single.single().id))
    }
    @Test fun composedCaptionsHaveFortyEightVariantsAndKeepCountAndPlatformInAllLanguages() {
        val scripts=mapOf("te" to '\u0C00'..'\u0C7F',"hi" to '\u0900'..'\u097F',
            "ta" to '\u0B80'..'\u0BFF',"kn" to '\u0C80'..'\u0CFF',"ml" to '\u0D00'..'\u0D7F')
        val kannada=MemeReaction("fixture","kn","fixture",listOf("{count} {feed} ಆಯ್ತು!","{count} {feed} ನೋಡಿದೆ!","{count} {feed} ದಾಟಿದೆ!"))
        for(meme in MemeCollection.all+kannada) {
            assertEquals(48,meme.captionVariantCount)
            val captions=(0 until 48).map {meme.caption(it,100,true)}
            assertEquals(48,captions.toSet().size)
            captions.forEach { text ->
                assertTrue(text.contains("100"));assertFalse(text.contains("{"))
                scripts[meme.language]?.let {script ->assertTrue(text.any{it in script})}
            }
            assertEquals(48,(0 until 48).map{meme.caption(it,1,false)}.toSet().size)
            var previous=-1
            repeat(100) {
                val index=MemeCollection.captionIndex(meme,previous,Random(it))
                assertNotEquals(previous,index);assertTrue(index in 0 until 48);previous=index
            }
        }
        assertTrue(kannada.caption(0,50,true).contains("ಶಾರ್ಟ್ಸ್"))
        assertTrue(kannada.caption(0,50,false).contains("ರೀಲ್ಸ್"))
        assertTrue(kannada.caption(0,1,true).contains("1 ಶಾರ್ಟ್"))
    }

}
