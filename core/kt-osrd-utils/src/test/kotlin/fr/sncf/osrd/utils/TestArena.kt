package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.indexing.DynIdx
import fr.sncf.osrd.utils.indexing.MutableArena
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

sealed interface A

class TestArena {
    @Test
    fun testArena() {
        val arena = MutableArena<A>(2)
        val a = arena.allocate()
        assertEquals(a, DynIdx(0u, 0u))
        assertEquals(listOf(a), arena.toList())
        assertFalse(arena.isValid(DynIdx(0u, 42u)))
        assertFalse(arena.isValid(DynIdx(1u, 0u)))
        assertTrue(arena.isValid(a))
        arena.release(a)
        assertEquals(listOf(), arena.toList())

        val b = arena.allocate()
        assertEquals(b, DynIdx(0u, 1u))

        val c = arena.allocate()
        assertEquals(c, DynIdx(1u, 0u))

        val d = arena.allocate()
        assertEquals(d, DynIdx(2u, 0u))

        val e = arena.allocate()
        assertEquals(e, DynIdx(3u, 0u))

        val f = arena.allocate()
        assertEquals(f, DynIdx(4u, 0u))

        assertEquals(listOf(f, e, d, c, b), arena.toList())
        arena.release(c)
        assertEquals(listOf(f, e, d, b), arena.toList())

        arena.release(f)
        assertEquals(listOf(e, d, b), arena.toList())

        arena.release(b)
        assertEquals(listOf(e, d), arena.toList())
    }
}
