package fr.sncf.osrd.new_infra.implementation.reservation;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.DiDetectorImpl;

import java.util.HashMap;
import java.util.Map;

import static fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge.TRACK_OBJECTS;

public class DetectorMaps {
    public final Map<String, DetectorImpl> detectorMap;
    public final Map<Direction, Map<String, DiDetector>> diDetectorMap;

    private DetectorMaps(Map<String, DetectorImpl> detectorMap,
                        Map<Direction, Map<String, DiDetector>> diDetectorMap) {
        this.detectorMap = detectorMap;
        this.diDetectorMap = diDetectorMap;
    }

    public static DetectorMaps from(DiTrackInfra infra) {
        var detectors = new HashMap<String, DetectorImpl>();
        var diDetectors = new HashMap<Direction, Map<String, DiDetector>>();
        for (var dir : Direction.values())
            diDetectors.put(dir, new HashMap<>());
        for (var track : infra.getTrackGraph().edges()) {
            for (var object : track.getAttrs().getAttrOrThrow(TRACK_OBJECTS)) {
                var newDetector = new DetectorImpl(object.getID());
                detectors.put(object.getID(), newDetector);
                for (var dir : Direction.values())
                    diDetectors.get(dir).put(object.getID(), new DiDetectorImpl(newDetector, dir));
            }
        }
        return new DetectorMaps(detectors, diDetectors);
    }
}
