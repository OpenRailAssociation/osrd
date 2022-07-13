package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class ReflectionTests {
    private class A {
        public static final String foo = "a";
    }

    private class B extends A {
        public static final String foo = "b";
        public static final String bar = "B";
    }

    private class C extends B {
        public static final String foo = "c";
    }

    private class D extends C {
        public static final String bar = "D";
    }

    @Test
    public void testHierarchicalLabelsFoo() {
        final var a = Reflection.makeHierarchicalLabel(A.class, "foo");
        final var b = Reflection.makeHierarchicalLabel(B.class, "foo");
        final var c = Reflection.makeHierarchicalLabel(C.class, "foo");
        final var d = Reflection.makeHierarchicalLabel(D.class, "foo");
        assertEquals("a", a);
        assertEquals("a:b", b);
        assertEquals("a:b:c", c);
        assertEquals("a:b:c", d);
    }

    @Test
    public void testHierarchicalLabelsBar() {
        final var a = Reflection.makeHierarchicalLabel(A.class, "bar");
        final var b = Reflection.makeHierarchicalLabel(B.class, "bar");
        final var c = Reflection.makeHierarchicalLabel(C.class, "bar");
        final var d = Reflection.makeHierarchicalLabel(D.class, "bar");
        assertEquals("", a);
        assertEquals("B", b);
        assertEquals("B", c);
        assertEquals("B:D", d);
    }
}
