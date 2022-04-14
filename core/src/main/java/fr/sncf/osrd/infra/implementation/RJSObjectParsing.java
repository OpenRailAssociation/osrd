package fr.sncf.osrd.infra.implementation;

import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import java.util.Map;
import java.util.Set;

public class RJSObjectParsing {
    public static Detector getDetector(RJSObjectRef<?> object, Map<String, ? extends Detector> cachedObjects) {
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

    public static RJSSwitchType getSwitchType(RJSObjectRef<?> object,
                                              Map<String, RJSSwitchType> switchTypeMap) {
        return parseRef(object, switchTypeMap, Set.of("SwitchType"));
    }

    private static <U> U parseRef(RJSObjectRef<?> object, Map<String, U> cachedObjects, Set<String> expectedTypes) {
        object.checkType(expectedTypes);
        return cachedObjects.get(object.id.id);
    }
}
