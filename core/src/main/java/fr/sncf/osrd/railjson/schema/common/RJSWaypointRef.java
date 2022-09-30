package fr.sncf.osrd.railjson.schema.common;

import com.squareup.moshi.Json;
import fr.sncf.osrd.infra.errors.InvalidInfraError;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@ExcludeFromGeneratedCodeCoverage
public final class RJSWaypointRef<T extends Identified> {
    public ID<T> id;

    public enum RJSWaypointType {
        @Json(name = "BufferStop")
        BUFFER_STOP,
        @Json(name = "Detector")
        DETECTOR
    }

    public RJSWaypointType type;

    public RJSWaypointRef(ID<T> id, RJSWaypointType type) {
        this.id = id;
        this.type = type;
    }

    public RJSWaypointRef(String id, RJSWaypointType type) {
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
        if (obj.getClass() != RJSWaypointRef.class)
            return false;
        var o = (RJSWaypointRef<?>) obj;
        return id.equals(o.id) && type.equals(o.type);
    }

    @Override
    public String toString() {
        return String.format("RJSWaypointRef { type=%s, id=%s }", type, id.id);
    }

    /** Checks that the type of the object matches one of the given expected types */
    public void checkType(Set<RJSWaypointType> expectedTypes) {
        if (!expectedTypes.contains(type))
            throw new InvalidInfraError(String.format(
                    "Mismatched ref type: expected %s, got (type=%s, id=%s)",
                    expectedTypes, type, id
            ));
    }
}
