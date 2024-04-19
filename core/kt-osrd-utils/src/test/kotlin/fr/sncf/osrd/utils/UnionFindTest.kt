package fr.sncf.osrd.utils

import kotlin.test.Test
import kotlin.test.assertEquals

internal class UnionFindTest {
    @Test
    fun unionFindTest() {
        val uf = UnionFind()
        val a: Int = uf.newGroup()
        assertEquals(a, 0)
        val b: Int = uf.newGroup()
        assertEquals(b, 1)
        val c: Int = uf.newGroup()
        assertEquals(c, 2)
        val d: Int = uf.newGroup()
        assertEquals(d, 3)
        uf.union(a, b)
        uf.union(c, d)
        assertEquals(uf.findRoot(a), 0)
        assertEquals(uf.findRoot(b), 0)
        assertEquals(uf.findRoot(c), 2)
        assertEquals(uf.findRoot(d), 2)
        val groupMap = ArrayList<Int>()
        assertEquals(uf.minimize(groupMap), 2)
        assertEquals(groupMap[a], 0)
        assertEquals(groupMap[b], 0)
        assertEquals(groupMap[c], 1)
        assertEquals(groupMap[d], 1)
    }
}
