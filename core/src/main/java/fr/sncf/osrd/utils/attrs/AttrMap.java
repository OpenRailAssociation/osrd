package fr.sncf.osrd.utils.attrs;

import org.checkerframework.checker.nullness.qual.NonNull;
import org.checkerframework.checker.nullness.qual.Nullable;

public interface AttrMap<B> {
    /** Returns the value of the attribute */
    @Nullable
    <T extends B> T getAttr(Attr<T> attr);

    /** Returns the value of the attribute, or the given default if absent */
    <T extends B> T getAttr(Attr<T> attr, T defaultValue);

    /** Returns the value of the attribute, or throw an OSRDError if absent */
    <T extends B> T getAttrOrThrow(Attr<T> attr);

    /** Sets the value of this attribute */
    <T extends B> void putAttr(Attr<T> attr, @NonNull T value);

    /** Iterate on all attributes */
    void forEach(AttrConsumer<B> consumer);
}
