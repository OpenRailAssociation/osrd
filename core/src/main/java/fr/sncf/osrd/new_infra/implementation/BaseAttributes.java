package fr.sncf.osrd.new_infra.implementation;

import fr.sncf.osrd.new_infra.api.WithAttributes;
import fr.sncf.osrd.utils.attrs.MutableAttrMap;

public class BaseAttributes implements WithAttributes {

    private final MutableAttrMap<Object> attrs = new MutableAttrMap<>();

    @Override
    public final MutableAttrMap<Object> getAttrs() {
        return attrs;
    }

    @Override
    public String toString() {
        return String.format("{%s, attrs: %s}", getClass().getName(), attrs);
    }
}
