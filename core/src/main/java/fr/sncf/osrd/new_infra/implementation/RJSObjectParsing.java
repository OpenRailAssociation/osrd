package fr.sncf.osrd.new_infra.implementation;

import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.new_infra.implementation.reservation.DetectorImpl;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.TrackSectionImpl;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import java.util.Map;
import java.util.Set;

public class RJSObjectParsing {
    public static DetectorImpl getDetector(RJSObjectRef<?> object, Map<String, DetectorImpl> cachedObjects) {
        return parseRef(object, cachedObjects, Set.of("Detector"));
    }

    public static TrackSection getTrackSection(RJSObjectRef<?> object, DiTrackInfra diTrackInfra) {
        object.checkType(Set.of("TrackSection"));
        return diTrackInfra.getTrackSection(object.id.id);
    }

    public static TrackSectionImpl getTrackSection(RJSObjectRef<?> object,
                                                   Map<String, TrackSectionImpl> cachedObjects) {
        return parseRef(object, cachedObjects, Set.of("TrackSection"));
    }

    private static <U> U parseRef(RJSObjectRef<?> object, Map<String, U> cachedObjects, Set<String> expectedTypes) {
        object.checkType(expectedTypes);
        return cachedObjects.get(object.id.id);
    }
}
