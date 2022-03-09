package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.utils.attrs.Attr;
import fr.sncf.osrd.utils.attrs.AttrMap;
import fr.sncf.osrd.utils.attrs.ImmutableAttrMap;
import fr.sncf.osrd.utils.attrs.MutableAttrMap;
import org.junit.jupiter.api.Test;

public class AttrMapTest {
    private final Attr<Integer> ATTR_INT_A = new Attr<>();
    private final Attr<Integer> ATTR_INT_B = new Attr<>();

    @Test
    public void testImmutableAttrMap() {
        // we have a singleton for empty maps
        assertSame(ImmutableAttrMap.<Number>of(), ImmutableAttrMap.<Number>of());

        AttrMap<Number> map = new ImmutableAttrMap.Builder<Number>()
                .putAttr(ATTR_INT_A, 42)
                .putAttr(ATTR_INT_B, 2)
                .build();
        assertEquals(42, map.getAttr(ATTR_INT_A));
        assertEquals(2, map.getAttr(ATTR_INT_B));
        assertThrows(UnsupportedOperationException.class, () -> map.putAttr(ATTR_INT_A, 1));
    }

    @Test
    public void testMutableAttrMap() {
        var map = new MutableAttrMap<Number>();
        map.putAttr(ATTR_INT_A, 42);
        map.putAttr(ATTR_INT_A, 12);
        map.putAttr(ATTR_INT_B, 2);

        assertEquals(12, map.getAttr(ATTR_INT_A));
        assertEquals(2, map.getAttr(ATTR_INT_B));
    }
}
