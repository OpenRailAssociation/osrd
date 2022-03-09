package fr.sncf.osrd.utils.attrs;

import org.checkerframework.checker.nullness.qual.NonNull;
import org.checkerframework.checker.nullness.qual.Nullable;

public interface AttrMap<B> {
    /** Returns the value of the attribute */
    @Nullable
    <T extends B> T getAttr(Attr<T> attr);

    /** Sets the value of this attribute */
    <T extends B> void putAttr(Attr<T> attr, @NonNull T value);

    /** Iterate on all attributes */
    void forEach(AttrConsumer<B> consumer);
}
