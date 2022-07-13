package fr.sncf.osrd.utils.attrs;

import com.google.common.collect.ImmutableMap;
import com.google.errorprone.annotations.CanIgnoreReturnValue;
import org.checkerframework.checker.nullness.qual.NonNull;


public class ImmutableAttrMap<B> extends BaseAttrMap<B> {
    private ImmutableAttrMap(ImmutableMap<Attr<? extends B>, B> map) {
        super(map);
    }

    /** A cached empty attribute map */
    private static final ImmutableAttrMap<?> EMPTY = new ImmutableAttrMap<>(ImmutableMap.of());

    /** Create an empty attribute map */
    @SuppressWarnings("unchecked")
    public static <B> ImmutableAttrMap<B> of() {
        return (ImmutableAttrMap<B>) EMPTY;
    }

    /** Create an attribute map with a single attribute */
    public static <B, T extends B> ImmutableAttrMap<B> of(Attr<T> attr, T value) {
        return new ImmutableAttrMap<>(ImmutableMap.of(attr, value));
    }

    @Override
    public <T extends B> void putAttr(Attr<T> attr, @NonNull T value) {
        throw new UnsupportedOperationException("immutable attribute map");
    }

    public static <B> Builder<B> builder() {
        return new Builder<>();
    }

    public static final class Builder<B> implements AttrConsumer<B> {
        private final ImmutableMap.Builder<Attr<? extends B>, B> mapBuilder = ImmutableMap.builder();

        @CanIgnoreReturnValue
        public <T extends B> Builder<B> putAttr(Attr<T> key, T value) {
            mapBuilder.put(key, value);
            return this;
        }

        @Override
        public <T extends B> void take(Attr<T> attr, @NonNull T value) {
            putAttr(attr, value);
        }

        /** Creates an immutable attribute map */
        public ImmutableAttrMap<B> build() {
            var map = mapBuilder.buildOrThrow();
            if (map.isEmpty())
                return of();
            return new ImmutableAttrMap<B>(map);
        }
    }
}
