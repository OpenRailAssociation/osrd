package fr.sncf.osrd.infra_state.implementation;

import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.infra_state.implementation.errors.InvalidPathError;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import java.util.ArrayList;
import java.util.List;

public class TrainPathBuilder {

    /** Build Train Path from routes, a starting and ending location */
    public static TrainPath from(
            List<SignalingRoute> routePath,
            TrackLocation startLocation,
            TrackLocation endLocation
    ) throws InvalidSchedule {
        ImmutableList<TrainPath.LocatedElement<TrackRangeView>> trackSectionPath;
        try {
            trackSectionPath = createTrackRangePath(routePath, startLocation, endLocation);
        } catch (RuntimeException e) {
            throw new InvalidSchedule(e.getMessage());
        }
        var detectors = createDetectorPath(trackSectionPath);
        double length = 0;
        for (var track : trackSectionPath)
            length += track.element().getLength();
        var locatedRoutePath = makeLocatedRoutePath(routePath, startLocation);
        var trainPath = new TrainPath(
                locatedRoutePath,
                trackSectionPath,
                detectors,
                makeDetectionSections(locatedRoutePath, length),
                length
        );
        validate(trainPath);
        return trainPath;
    }

    /** Build Train Path from an RailJSON train path */
    public static TrainPath from(SignalingInfra infra, RJSTrainPath rjsTrainPath) throws InvalidSchedule {
        try {
            var routePath = new ArrayList<SignalingRoute>();
            for (var rjsRoutePath : rjsTrainPath.routePath) {
                var route = infra.findSignalingRoute(rjsRoutePath.route, rjsRoutePath.signalingType);
                if (route == null)
                    throw new InvalidSchedule(String.format(
                            "Can't find route %s (type %s)",
                            rjsRoutePath.route,
                            rjsRoutePath.signalingType));
                routePath.add(route);
            }

            var rjsStartTrackRange = rjsTrainPath.routePath.get(0).trackSections.get(0);
            var startLocation = new TrackLocation(
                    infra.getTrackSection(rjsStartTrackRange.track),
                    rjsStartTrackRange.getBegin()
            );

            var rjsEndRoutePath = rjsTrainPath.routePath.get(rjsTrainPath.routePath.size() - 1);
            var rjsEndTrackRange = rjsEndRoutePath.trackSections.get(rjsEndRoutePath.trackSections.size() - 1);
            var endLocation = new TrackLocation(
                    infra.getTrackSection(rjsEndTrackRange.track),
                    rjsEndTrackRange.getEnd()
            );

            return from(routePath, startLocation, endLocation);
        } catch (OSRDError e) {
            throw new InvalidSchedule(e.getMessage());
        }
    }

    /** check that everything make sense */
    private static void validate(TrainPath path) {
        assert !path.routePath().isEmpty() : "empty route path";
        assert !path.trackRangePath().isEmpty() : "empty track range path";
        assert path.length() >= 0 : "length must be positive";

        checkDetectorOverlap(path.detectors());
        if (path.detectionSections().size() > 0)
            validateDetectionSections(path);
        checkRangeLength(path);
    }

    /** Checks that when changing tracks, the ranges reach the end of each track */
    @SuppressFBWarnings("FE_FLOATING_POINT_EQUALITY")
    private static void checkRangeLength(TrainPath path) {
        for (int i = 1; i < path.trackRangePath().size(); i++) {
            var prevRange = path.trackRangePath().get(i - 1).element();
            var nextRange = path.trackRangePath().get(i).element();
            if (prevRange.track != nextRange.track) {
                if (prevRange.track.getDirection().equals(Direction.FORWARD))
                    assert prevRange.end == prevRange.track.getEdge().getLength() : "path isn't continuous";
                else
                    assert prevRange.begin == 0. : "path isn't continuous";
                if (nextRange.track.getDirection().equals(Direction.FORWARD))
                    assert nextRange.begin == 0 : "path isn't continuous";
                else
                    assert nextRange.end == nextRange.track.getEdge().getLength() : "path isn't continuous";
            }
        }
    }

    /** Checks that detectors don't overlap */
    private static void checkDetectorOverlap(ImmutableList<TrainPath.LocatedElement<DiDetector>> detectors) {
        for (int i = 1; i < detectors.size(); i++)
            if (detectors.get(i - 1).pathOffset() >= detectors.get(i).pathOffset())
                throw new InvalidPathError(String.format(
                        "Detector offsets must be strictly increasing (prev = %s, next = %s)",
                        detectors.get(i - 1), detectors.get(i)
                ));
    }

    /** Checks that the detectors and detection section transitions are consistent */
    private static void validateDetectionSections(TrainPath path) {
        int detSectionIndex = 0;
        var firstOffset = path.detectionSections().get(0).pathOffset();
        if (firstOffset < 0
                || (firstOffset == 0
                && path.detectors().size() > 0
                && path.detectors().get(0).pathOffset() > 0))
            detSectionIndex = 1;
        for (int detectorIndex = 0; detectorIndex < path.detectors().size(); detectorIndex++) {
            assert detSectionIndex <= path.detectionSections().size() : "missing detection sections";
            if (detSectionIndex < path.detectionSections().size()) {
                assert Math.abs(path.detectors().get(detectorIndex).pathOffset()
                        - path.detectionSections().get(detSectionIndex).pathOffset())
                        < 1e-5
                        : "detector / section offset mismatch";
            }
            detSectionIndex++;
        }
        assert Math.abs(path.detectionSections().size() - path.detectors().size()) <= 1
                : "Detection section size is inconsistent";
    }

    /** Creates the list of located routes */
    private static ImmutableList<TrainPath.LocatedElement<SignalingRoute>> makeLocatedRoutePath(
            List<SignalingRoute> routePath,
            TrackLocation startLocation
    ) {
        var res = ImmutableList.<TrainPath.LocatedElement<SignalingRoute>>builder();
        var offsetOnFirstRoute = offsetFromStartOfPath(
                routePath.get(0).getInfraRoute().getTrackRanges(),
                startLocation
        );
        var offset = -offsetOnFirstRoute;
        if (Math.abs(offset) == 0)
            offset = 0; // avoids the annoying -0
        for (var route : routePath) {
            res.add(new TrainPath.LocatedElement<>(offset, route));
            offset += route.getInfraRoute().getLength();
        }
        return res.build();
    }

    /** Returns the distance between the beginning of the list of ranges and the given location */
    private static double offsetFromStartOfPath(ImmutableList<TrackRangeView> path, TrackLocation location) {
        var offset = 0.;
        for (var range : path) {
            if (range.contains(location))
                return offset + range.offsetOf(location);
            offset += range.getLength();
        }
        throw new RuntimeException("Location isn't in the given path");
    }

    /** Creates a list of located directed detectors on the path */
    private static ImmutableList<TrainPath.LocatedElement<DiDetector>> createDetectorPath(
            ImmutableList<TrainPath.LocatedElement<TrackRangeView>> trackSectionPath
    ) {
        var res = new ArrayList<TrainPath.LocatedElement<DiDetector>>();
        double offset = 0.;
        for (var range : trackSectionPath) {
            for (var object : range.element().getDetectors()) {
                if (object.element() != null)
                    addIfDifferent(res, new TrainPath.LocatedElement<>(offset + object.offset(),
                            object.element().getDiDetector(range.element().track.getDirection())));
            }
            offset += range.element().getLength();
        }
        return ImmutableList.copyOf(res);
    }

    /** Creates the list of detection sections on the path */
    private static ImmutableList<TrainPath.LocatedElement<DetectionSection>> makeDetectionSections(
            ImmutableList<TrainPath.LocatedElement<SignalingRoute>> routePath,
            double pathLength
    ) {
        var res = new ArrayList<TrainPath.LocatedElement<DetectionSection>>();
        var offset = routePath.get(0).pathOffset();
        for (var locatedRoute : routePath) {
            var route = locatedRoute.element();
            for (var range : route.getInfraRoute().getTrackRanges()) {
                for (var object : range.getDetectors()) {
                    var diDetector = object.element().getDiDetector(range.track.getDirection());
                    var detectionSection = diDetector.detector().getNextDetectionSection(diDetector.direction());
                    addIfDifferent(res, new TrainPath.LocatedElement<>(offset + object.offset(), detectionSection));
                }
                offset += range.getLength();
            }
        }

        // Remove the first sections until only one start with a negative offset (the one we start on)
        while (res.size() > 1 && res.get(1).pathOffset() < 0)
            res.remove(0);
        // Remove the sections that start after the end of the path
        res.removeIf(section -> section.pathOffset() >= pathLength);

        return ImmutableList.copyOf(res);
    }

    /** Creates the lists of track ranges */
    private static ImmutableList<TrainPath.LocatedElement<TrackRangeView>> createTrackRangePath(
            List<SignalingRoute> routePath,
            TrackLocation startLocation,
            TrackLocation endLocation
    ) {
        var res = new ArrayList<TrainPath.LocatedElement<TrackRangeView>>();
        double offset = 0.;
        var reachedStart = false;
        var reachedEnd = false;
        for (int i = 0; i < routePath.size(); i++) {
            var signalingRoute = routePath.get(i);
            var route = signalingRoute.getInfraRoute();
            for (var range : route.getTrackRanges()) {
                if (!reachedStart) {
                    if (!range.contains(startLocation))
                        continue;
                    reachedStart = true;
                    range = range.truncateBegin(startLocation.offset());
                }
                // We have to check if we're on the last route to avoid problems with looping paths
                if (i == routePath.size() - 1 && range.contains(endLocation)) {
                    range = range.truncateEnd(endLocation.offset());
                    reachedEnd = true;
                }
                res.add(new TrainPath.LocatedElement<>(offset, range));
                offset += range.getLength();
                if (reachedEnd)
                    break;
            }
        }
        assert reachedStart : "Start location isn't included in the route graph";
        assert reachedEnd : "End location isn't included in the route graph";
        return ImmutableList.copyOf(res);
    }

    /** Adds a located element if it's not already the last on the list */
    private static <T> void addIfDifferent(List<TrainPath.LocatedElement<T>> list,
                                           TrainPath.LocatedElement<T> element) {
        if (list.isEmpty() || list.get(list.size() - 1).element() != element.element())
            list.add(element);
    }
}
