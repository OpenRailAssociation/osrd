package fr.sncf.osrd.railjson.schema.rollingstock;

import com.google.common.collect.Sets;
import com.squareup.moshi.Json;
import java.util.Set;

public enum RJSLoadingGaugeType {
    G1,
    G2,
    GA,
    GB,
    GB1,
    GC,
    @Json(name = "FR3.3")
    FR3_3,
    @Json(name = "FR3.3/GB/G2")
    FR3_3_GB_G2,
    GLOTT;

    /** Returns all the rolling stock gauge types compatible with the given track type
     * Returns null if the type is invalid for a track */
    public Set<RJSLoadingGaugeType> getCompatibleGaugeTypes() {
        return switch (this) {
            case G1 -> Set.of(G1);
            case GA -> Sets.union(Set.of(GA), G1.getCompatibleGaugeTypes());
            case GB -> Sets.union(Set.of(GB, FR3_3_GB_G2), GA.getCompatibleGaugeTypes());
            case GB1 -> Sets.union(Set.of(GB1), GB.getCompatibleGaugeTypes());
            case GC -> Sets.union(Set.of(GC), GB1.getCompatibleGaugeTypes());
            case G2 -> Sets.union(Set.of(G2, FR3_3_GB_G2), G1.getCompatibleGaugeTypes());
            case FR3_3 -> Set.of(FR3_3, FR3_3_GB_G2);
            case GLOTT -> Set.of(GLOTT);
            default -> null;
        };
    }
}
