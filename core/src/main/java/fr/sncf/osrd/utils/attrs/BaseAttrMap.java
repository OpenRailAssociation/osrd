package fr.sncf.osrd.utils.attrs;

import fr.sncf.osrd.exceptions.OSRDError;
import org.checkerframework.checker.nullness.qual.NonNull;
import org.checkerframework.checker.nullness.qual.Nullable;
import java.io.Serial;
import java.util.Map;
import java.util.StringJoiner;

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

    @SuppressWarnings({"unchecked"})
    @Override
    public <T extends B> T getAttr(Attr<T> attr, T defaultValue) {
        if (attrs.containsKey(attr))
            return (T) attrs.get(attr);
        return defaultValue;
    }

    @SuppressWarnings({"unchecked"})
    @Override
    public <T extends B> T getAttrOrThrow(Attr<T> attr) {
        if (attrs.containsKey(attr))
            return (T) attrs.get(attr);
        throw new MissingAttributeError();
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

    @Override
    public String toString() {
        var builder = new StringJoiner(", ", "{", "}");
        for (var entry : attrs.entrySet())
            builder.add(String.format("%s: %s", entry.getKey(), entry.getValue()));
        return builder.toString();
    }

    public static class MissingAttributeError extends OSRDError {
        @Serial
        private static final long serialVersionUID = -5910731445080615975L;
        public static final String osrdErrorType = "missing_attribute";

        protected MissingAttributeError() {
            super("referencing missing attribute", ErrorCause.INTERNAL);
            // We can't properly serialize Attr instances, we would need the original variable name
        }
    }
}
