package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.util.UnionFind;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;

class UnionFindTest {
    @Test
    public void unionFindTest() {
        var uf = new UnionFind();

        var a = uf.newGroup();
        assertEquals(a, 0);
        var b = uf.newGroup();
        assertEquals(b, 1);
        var c = uf.newGroup();
        assertEquals(c, 2);
        var d = uf.newGroup();
        assertEquals(d, 3);

        uf.union(a, b);
        uf.union(c, d);

        assertEquals(uf.findRoot(a), 0);
        assertEquals(uf.findRoot(b), 0);
        assertEquals(uf.findRoot(c), 2);
        assertEquals(uf.findRoot(d), 2);

        var groupMap = new ArrayList<Integer>();
        assertEquals(uf.minimize(groupMap), 2);

        assertEquals(groupMap.get(a), 0);
        assertEquals(groupMap.get(b), 0);
        assertEquals(groupMap.get(c), 1);
        assertEquals(groupMap.get(d), 1);
    }
}
