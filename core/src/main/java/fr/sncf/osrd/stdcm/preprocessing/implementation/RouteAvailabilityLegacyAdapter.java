package fr.sncf.osrd.stdcm.preprocessing.implementation;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.stdcm.OccupancyBlock;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
import java.util.List;

/** This class implements the RouteAvailabilityInterface using the legacy route occupancy data.
 * It's meant to be removed once the rest of the "signaling sim - stdcm" pipeline is implemented. */
public class RouteAvailabilityLegacyAdapter implements RouteAvailabilityInterface {

    private final Multimap<SignalingRoute, OccupancyBlock> unavailableSpace;

    /** Constructor */
    public RouteAvailabilityLegacyAdapter(
            Multimap<SignalingRoute, OccupancyBlock> unavailableSpace
    ) {
        this.unavailableSpace = unavailableSpace;
    }

    @Override
    public Availability getAvailability(
            TrainPath path,
            double startOffset,
            double endOffset,
            Envelope envelope,
            double startTime
    ) {
        assert Math.abs((endOffset - startOffset) - envelope.getEndPos()) < 1e-5;
        var unavailability = findMinimumDelay(path, startOffset, endOffset, envelope, startTime);
        if (unavailability != null)
            return unavailability;
        return findMaximumDelay(path, startOffset, endOffset, envelope, startTime);
    }

    /** Find the minimum delay needed to avoid any conflict.
     * Returns 0 if the train isn't currently causing any conflict. */
    Unavailable findMinimumDelay(
            TrainPath path,
            double startOffset,
            double endOffset,
            Envelope envelope,
            double startTime
    ) {
        double minimumDelay = 0;
        double conflictOffset = 0;
        for (var locatedRoute : iteratePathInRange(path, startOffset, endOffset)) {
            for (var block : unavailableSpace.get(locatedRoute.element())) {
                var trainInBlock = timeTrainInBlock(
                        block,
                        locatedRoute,
                        startOffset,
                        envelope,
                        startTime
                );
                if (trainInBlock == null)
                    continue;
                if (trainInBlock.start < block.timeEnd()
                        && trainInBlock.end > block.timeStart()) {
                    var blockMinimumDelay = block.timeEnd() - trainInBlock.start;
                    if (blockMinimumDelay > minimumDelay) {
                        minimumDelay = blockMinimumDelay;
                        if (trainInBlock.start <= block.timeStart()) {
                            // The train enters the block before it's unavailable: conflict at end location
                            conflictOffset = locatedRoute.pathOffset() + block.distanceEnd();
                        } else {
                            // The train enters the block when it's already unavailable: conflict at start location
                            conflictOffset = locatedRoute.pathOffset() + block.distanceStart();
                        }
                    }
                }
            }
        }
        if (minimumDelay == 0)
            return null;
        if (Double.isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts that appear with the added delay
            var recursive = findMinimumDelay(path, startOffset, endOffset, envelope, startTime + minimumDelay);
            if (recursive != null)
                minimumDelay += recursive.duration;
        }
        conflictOffset = Math.max(0, Math.min(path.length(), conflictOffset));
        return new Unavailable(minimumDelay, conflictOffset);
    }

    /** Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict. */
    Available findMaximumDelay(
            TrainPath path,
            double startOffset,
            double endOffset,
            Envelope envelope,
            double startTime
    ) {
        double maximumDelay = Double.POSITIVE_INFINITY;
        double timeOfNextOccupancy = Double.POSITIVE_INFINITY;
        for (var locatedRoute : iteratePathInRange(path, startOffset, endOffset)) {
            for (var block : unavailableSpace.get(locatedRoute.element())) {
                var trainInBlock = timeTrainInBlock(
                        block,
                        locatedRoute,
                        startOffset,
                        envelope,
                        startTime
                );
                if (trainInBlock == null || trainInBlock.start >= block.timeEnd())
                    continue; // The block is occupied before we enter it
                assert trainInBlock.start <= block.timeStart();
                var maxDelayForBlock = block.timeStart() - trainInBlock.end;
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock;
                    timeOfNextOccupancy = block.timeStart();
                }
            }
        }
        return new Available(maximumDelay, timeOfNextOccupancy);
    }

    /** Returns the list of routes in the given interval on the path */
    private static List<TrainPath.LocatedElement<SignalingRoute>> iteratePathInRange(
            TrainPath path,
            double start,
            double end
    ) {
        return path.routePath().stream()
                .filter(r -> r.pathOffset() < end)
                .filter(r -> r.pathOffset() + r.element().getInfraRoute().getLength() > start)
                .toList();
    }

    /** Returns the time interval during which the train is on the given blocK. */
    private static TimeInterval timeTrainInBlock(
            OccupancyBlock block,
            TrainPath.LocatedElement<SignalingRoute> route,
            double startOffset,
            Envelope envelope,
            double startTime
    ) {
        var startRouteOffsetOnEnvelope = route.pathOffset() - startOffset;
        // Offsets on the envelope
        var blockEnterOffset = startRouteOffsetOnEnvelope + block.distanceStart();
        var blockExitOffset = startRouteOffsetOnEnvelope + block.distanceEnd();

        if (blockEnterOffset > envelope.getEndPos() || blockExitOffset < 0)
            return null;

        var enterTime = startTime + envelope.interpolateTotalTimeClamp(blockEnterOffset);
        var exitTime = startTime + envelope.interpolateTotalTimeClamp(blockExitOffset);
        return new TimeInterval(enterTime, exitTime);
    }

    private record TimeInterval(
            double start,
            double end
    ) {}
}
