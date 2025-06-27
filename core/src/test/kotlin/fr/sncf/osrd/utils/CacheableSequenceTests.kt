package fr.sncf.osrd.utils

import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse

class CacheableSequenceTests {
    @Test
    fun basicTest() {
        // Generate all natural integers, asserting that it's only generated once
        val alreadyGenerated = mutableSetOf<Int>()
        val sequence =
            generateSequence(0) {
                assertFalse(alreadyGenerated.contains(it))
                alreadyGenerated.add(it)
                it + 1
            }
        val cached = sequence.cacheable()
        val firstGeneration = cached.take(10).toList()
        assertEquals((0..9).toList(), firstGeneration)
        val secondGeneration = cached.take(20).toList()
        assertEquals((0..19).toList(), secondGeneration)
    }
}
