package fr.sncf.osrd.new_infra.api;

import fr.sncf.osrd.utils.attrs.MutableAttrMap;

public interface WithAttributes {
    MutableAttrMap<Object> getAttrs();
}
