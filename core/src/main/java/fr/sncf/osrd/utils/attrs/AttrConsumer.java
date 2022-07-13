package fr.sncf.osrd.utils.attrs;

import org.checkerframework.checker.nullness.qual.NonNull;

public interface AttrConsumer<B> {
    <T extends B> void take(Attr<T> attr, @NonNull T value);
}
