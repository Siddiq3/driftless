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
    @Test fun everyMemeHasABundledGifThatMatchesTheManifest() {
        val dir = java.io.File("src/main/assets/memes")
        val manifest = java.io.File("../../../docs/MEME-ASSETS.json").readText()
        // org.json is stubbed in JVM tests; each downloaded entry lists id, …, status, sha256 in order.
        val hashes = Regex(""""id": "(\d+)"[^}]*?"status": "downloaded"[^}]*?"sha256": "([0-9a-f]{64})"""")
            .findAll(manifest).associate { it.groupValues[1] to it.groupValues[2] }
        val bundled = dir.list().orEmpty().filter { it.endsWith(".gif") }.map { it.removeSuffix(".gif") }.toSet()
        assertEquals(MemeCollection.all.map { it.id }.toSet(), bundled)
        MemeCollection.all.forEach { meme ->
            val bytes = java.io.File(dir, "${meme.id}.gif").readBytes()
            assertEquals(meme.description, "GIF8", String(bytes.copyOf(4)))
            val sha = java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            assertEquals(meme.description, hashes[meme.id], sha)
        }
    }
    @Test fun collectionHasDistinctReactionsAndNativeScriptCopy() {
        assertEquals(21, MemeCollection.all.size)
        assertEquals(21, MemeCollection.all.map { it.id }.toSet().size)
        assertFalse(MemeCollection.all.any { it.id == "2220434" })
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
    @Test fun poolHoldsEveryMemeCaptionedInTheLanguageAndFallsBackToEnglish() {
        val telugu=MemeCollection.poolForLanguage(MemeCollection.all,"te")
        assertEquals(MemeCollection.all,telugu)
        assertTrue(telugu.any {it.language!="te"})
        val used=mutableSetOf<String>();var last:String?=null
        repeat(telugu.size) {
            val next=MemeCollection.choose(telugu,used,last,Random(it))!!
            assertTrue(used.add(next.id));last=next.id
        }
        assertNotEquals(last,MemeCollection.choose(telugu,used,last,Random(2))!!.id)
        assertEquals(MemeCollection.all,MemeCollection.poolForLanguage(MemeCollection.all,"en"))
        assertEquals("en",MemeCollection.displayLanguage(MemeCollection.all,"kn"))
        assertEquals(MemeCollection.all,MemeCollection.poolForLanguage(MemeCollection.all,"kn"))
        assertTrue(MemeCollection.poolForLanguage(emptyList(),"te").isEmpty())
        assertTrue(MemeCollection.poolForLanguage(MemeCollection.all,"hi").all {it.language=="hi"})
        val single=MemeCollection.poolForLanguage(MemeCollection.all,"ml")
        assertEquals(1,single.size)
        assertEquals(single.single(),MemeCollection.choose(single,setOf(single.single().id),single.single().id))
    }
    @Test fun everyCaptionIsAWholeLineThatKeepsCountAndPlatformInAllLanguages() {
        val scripts=mapOf("te" to '\u0C00'..'\u0C7F',"hi" to '\u0900'..'\u097F',
            "ta" to '\u0B80'..'\u0BFF',"kn" to '\u0C80'..'\u0CFF',"ml" to '\u0D00'..'\u0D7F')
        val kannada=MemeReaction("fixture","kn","fixture",listOf("{count} {feed} ಆಯ್ತು!","{count} {feed} ನೋಡಿದೆ!","{count} {feed} ದಾಟಿದೆ!"))
        for(meme in MemeCollection.all+kannada) for(lang in listOf(meme.language)+meme.translations.keys) {
            val n=meme.captionVariantCount(lang)
            assertTrue("${meme.description} $lang",n>=3)
            val captions=(0 until n).map {meme.caption(it,100,true,lang)}
            assertEquals(n,captions.toSet().size)
            captions.forEach { text ->
                assertTrue(text.contains("100"));assertFalse(text.contains("{"))
                scripts[lang]?.let {script ->assertTrue(text,text.any{it in script})}
            }
            assertEquals(3,(0 until n).map{meme.caption(it,1,false,lang)}.toSet().size)
            var previous=-1
            repeat(100) {
                val index=MemeCollection.captionIndex(meme,previous,Random(it),lang)
                assertNotEquals(previous,index);assertTrue(index in 0 until n);previous=index
            }
        }
        assertTrue(kannada.caption(0,50,true).contains("ಶಾರ್ಟ್ಸ್"))
        assertTrue(kannada.caption(0,50,false).contains("ರೀಲ್ಸ್"))
        assertTrue(kannada.caption(0,1,true).contains("1 ಶಾರ್ಟ್"))
    }

}
