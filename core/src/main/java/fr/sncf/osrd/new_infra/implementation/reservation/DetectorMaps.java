package fr.sncf.osrd.new_infra.implementation.reservation;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DiDetectorImpl;
import java.util.HashMap;
import java.util.Map;

/** Utility class to instantiate all the detectors (package private).
 * This lets us run DetectionSectionBuilder on its own without duplicating code. */
class DetectorMaps {
    /** Map detector IDs to their instance */
    public final Map<String, DetectorImpl> detectorMap;
    /** Map direction and detector IDs to their directed instance */
    public final Map<Direction, Map<String, DiDetector>> diDetectorMap;

    private DetectorMaps(Map<String, DetectorImpl> detectorMap,
                        Map<Direction, Map<String, DiDetector>> diDetectorMap) {
        this.detectorMap = detectorMap;
        this.diDetectorMap = diDetectorMap;
    }

    /** Instantiates all Detectors and DiDetectors, and returns the maps */
    public static DetectorMaps from(DiTrackInfra infra) {
        var detectors = new HashMap<String, DetectorImpl>();
        var diDetectors = new HashMap<Direction, Map<String, DiDetector>>();
        for (var dir : Direction.values())
            diDetectors.put(dir, new HashMap<>());
        for (var track : infra.getTrackGraph().edges()) {
            for (var object : track.getTrackObjects()) {
                var newDetector = new DetectorImpl(object.getID());
                object.setDetector(newDetector);
                detectors.put(object.getID(), newDetector);
                var diDetectorForward = new DiDetectorImpl(newDetector, Direction.FORWARD);
                diDetectors.get(Direction.FORWARD).put(object.getID(), diDetectorForward);
                var diDetectorBackward = new DiDetectorImpl(newDetector, Direction.BACKWARD);
                diDetectors.get(Direction.BACKWARD).put(object.getID(), diDetectorBackward);
                newDetector.setDiDetectors(Map.of(
                        Direction.FORWARD, diDetectorForward,
                        Direction.BACKWARD, diDetectorBackward
                ));
            }
        }
        return new DetectorMaps(detectors, diDetectors);
    }
}
