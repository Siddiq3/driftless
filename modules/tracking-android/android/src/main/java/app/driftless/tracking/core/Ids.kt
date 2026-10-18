package app.driftless.tracking.core

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

/** UUIDv7 (RFC 9562): 48-bit ms timestamp + random. Time-ordered, globally unique event ids. */
class UuidV7(private val random: SecureRandom = SecureRandom(), private val clock: () -> Long = System::currentTimeMillis) {
    private var lastMs = -1L
    private var counter = 0

    @Synchronized
    fun next(): UUID {
        var ms = clock()
        if (ms <= lastMs) {
            // Same or earlier millisecond (clock went backwards): keep ordering monotonic.
            ms = lastMs
            counter++
        } else {
            counter = 0
        }
        lastMs = ms
        val randA = (counter and 0x0FFF).toLong() // 12 bits
        val msb = (ms shl 16) or (0x7L shl 12) or randA
        val lsb = (random.nextLong() and 0x3FFFFFFFFFFFFFFFL) or Long.MIN_VALUE // variant 10
        return UUID(msb, lsb)
    }
}

/**
 * Turns selected on-screen attributes of the current item into an irreversible, salted code.
 * Plaintext never leaves this function and is never stored (PRIVACY_AND_DATA_RETENTION §1).
 * The salt is per install and rotated daily, so codes can't be linked across days.
 */
object Fingerprint {
    fun of(salt: ByteArray, parts: List<String>): String {
        val md = MessageDigest.getInstance("SHA-256")
        md.update(salt)
        for (p in parts) {
            md.update(0x1F) // unit separator, so ["ab","c"] != ["a","bc"]
            md.update(p.toByteArray(Charsets.UTF_8))
        }
        return md.digest().copyOf(16).joinToString("") { "%02x".format(it) }
    }

    /** Daily salt derived from the install secret and the local date. */
    fun dailySalt(installSecret: ByteArray, localDate: String): ByteArray {
        val md = MessageDigest.getInstance("SHA-256")
        md.update(installSecret)
        md.update(localDate.toByteArray(Charsets.UTF_8))
        return md.digest()
    }
}
