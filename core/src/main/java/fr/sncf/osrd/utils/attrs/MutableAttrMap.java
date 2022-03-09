package fr.sncf.osrd.utils.attrs;

import java.util.HashMap;
import java.util.Map;


public class MutableAttrMap<B> extends BaseAttrMap<B> {
    private MutableAttrMap(Map<Attr<? extends B>, B> map) {
        super(map);
    }

    public MutableAttrMap() {
        this(new HashMap<>());
    }

    public static <B> MutableAttrMap<B> of() {
        return new MutableAttrMap<>(new HashMap<>());
    }

    /** Create a new mutable attribute map with the given attribute */
    public static <B, T extends B> MutableAttrMap<B> of(Attr<T> attr, T value) {
        var map = new HashMap<Attr<? extends B>, B>();
        map.put(attr, value);
        return new MutableAttrMap<>(map);
    }
}
