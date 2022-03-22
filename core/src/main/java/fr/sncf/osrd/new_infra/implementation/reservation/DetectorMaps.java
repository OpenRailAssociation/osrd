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
                detectors.put(object.getID(), newDetector);
                for (var dir : Direction.values())
                    diDetectors.get(dir).put(object.getID(), new DiDetectorImpl(newDetector, dir));
            }
        }
        return new DetectorMaps(detectors, diDetectors);
    }
}
