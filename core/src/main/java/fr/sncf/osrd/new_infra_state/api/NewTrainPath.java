package fr.sncf.osrd.new_infra_state.api;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.List;
import java.util.stream.Collectors;

public record NewTrainPath(
        ImmutableList<LocatedElement<SignalingRoute>> routePath,
        ImmutableList<LocatedElement<TrackRangeView>> trackRangePath,
        ImmutableList<LocatedElement<DiDetector>> detectors,
        ImmutableList<LocatedElement<DetectionSection>> detectionSections,
        double length
) {

    /** An element located with the offset from the start of the path.
     * For ranges and routes, it's the position of the start of the object
     * (negative if the path start is in the middle of an object). */
    public record LocatedElement<T>(double pathOffset, T element) {}

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("routePath", routePath)
                .add("trackRangePath", trackRangePath)
                .add("detectors", detectors)
                .add("detectionSections", detectionSections)
                .add("length", length)
                .toString();
    }

    /** Utility function, converts a list of LocatedElement into a list of element */
    public static <T> List<T> removeLocation(ImmutableList<LocatedElement<T>> list) {
        return list.stream()
                .map(x -> x.element)
                .collect(Collectors.toList());
    }

    /** Utility function, returns the last element with offset <= the given offset.
     * For range objects (route / sections), it returns the element containing the offset. */
    public static <T> T getLastElementBefore(ImmutableList<LocatedElement<T>> list, double offset) {
        for (int i = 0; i < list.size(); i++) {
            var e = list.get(i);
            if (e.pathOffset > offset && i > 0)
                return list.get(i - 1).element;
            if (e.pathOffset >= offset)
                return e.element;
        }
        return list.get(list.size() - 1).element;
    }
}
