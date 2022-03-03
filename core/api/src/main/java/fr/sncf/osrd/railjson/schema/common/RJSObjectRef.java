package fr.sncf.osrd.railjson.schema.common;

import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@ExcludeFromGeneratedCodeCoverage
public final class RJSObjectRef<T extends Identified> {
    public ID<T> id;
    public String type;

    public RJSObjectRef(ID<T> id, String type) {
        this.id = id;
        this.type = type;
    }

    public RJSObjectRef(String id, String type) {
        this(new ID<>(id), type);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, type);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != RJSObjectRef.class)
            return false;
        var o = (RJSObjectRef<?>) obj;
        return id.equals(o.id) && type.equals(o.type);
    }

    @Override
    public String toString() {
        return String.format("RJSObjectRef { type=%s, id=%s }", type, id.id);
    }

    public <U> U parseRef(Map<String, U> cachedObjects, String expectedType) {
        return parseRef(cachedObjects, Set.of(expectedType));
    }

    public <U> U parseRef(Map<String, U> cachedObjects, Set<String> expectedTypes) {
        if (!expectedTypes.contains(type))
            throw new RuntimeException(String.format(
                    "Mismatched ref type: expected %s, got (type=%s, id=%s)",
                    expectedTypes, type, id
            ));
        return cachedObjects.get(id.id);
    }
}
