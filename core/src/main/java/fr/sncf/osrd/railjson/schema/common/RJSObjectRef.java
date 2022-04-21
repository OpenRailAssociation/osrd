package fr.sncf.osrd.railjson.schema.common;

import fr.sncf.osrd.infra.errors.InvalidInfraError;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.HashMap;
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


    private <U> U parseRef(Map<String, ? extends U> cachedObjects, String expectedType) {
        return parseRef(cachedObjects, Set.of(expectedType));
    }

    private <U> U parseRef(Map<String, U> cachedObjects, Set<String> expectedTypes) {
        checkType(expectedTypes);
        return cachedObjects.get(id.id);
    }

    /** Checks that the type of the object matches one of the given expected types */
    public void checkType(Set<String> expectedTypes) {
        if (!expectedTypes.contains(type))
            throw new InvalidInfraError(String.format(
                    "Mismatched ref type: expected %s, got (type=%s, id=%s)",
                    expectedTypes, type, id
            ));
    }

    public RJSSwitchType getSwitchType(HashMap<String, RJSSwitchType> switchTypeMap) {
        return parseRef(switchTypeMap, "SwitchType");
    }
}
