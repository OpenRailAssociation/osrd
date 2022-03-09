package fr.sncf.osrd.utils.attrs;

import org.checkerframework.checker.nullness.qual.NonNull;
import org.checkerframework.checker.nullness.qual.Nullable;
import java.util.Map;

abstract class BaseAttrMap<B> implements AttrMap<B> {
    private final Map<Attr<? extends B>, B> attrs;

    protected BaseAttrMap(Map<Attr<? extends B>, B> attrs) {
        this.attrs = attrs;
    }

    @SuppressWarnings({"unchecked"})
    @Override
    public <T extends B> @Nullable T getAttr(Attr<T> attr) {
        return (T) attrs.get(attr);
    }

    @Override
    public <T extends B> void putAttr(Attr<T> attr, @NonNull T value) {
        attrs.put(attr, value);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Override
    public void forEach(AttrConsumer<B> consumer) {
        for (var entry : attrs.entrySet()) {
            var attr = (Attr) entry.getKey();
            var value = entry.getValue();
            consumer.take(attr, value);
        }
    }
}
