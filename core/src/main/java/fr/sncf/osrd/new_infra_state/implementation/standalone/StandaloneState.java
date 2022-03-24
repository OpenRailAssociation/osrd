package fr.sncf.osrd.new_infra_state.implementation.standalone;

import com.google.common.collect.*;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra_state.api.DetectionSectionState;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.new_infra_state.api.ReservationRouteState;
import java.util.HashMap;
import java.util.Map;

/** A simple implementation of InfraStateView that supports only a single train. */
@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class StandaloneState implements InfraStateView {

    /** Train path */
    private final NewTrainPath trainPath;
    /** For each detection section, the train position range where it is occupied */
    private final Map<DetectionSection, OccupationRange> sectionOccupationRanges;
    /** For each route, the train position range where it is occupied */
    private final Map<ReservationRoute, OccupationRange> routeOccupationRanges;
    /** Current offset of the train */
    private double currentOffset = 0;

    /** Keys are positions, values are a set of sections which state change when the train is at this position */
    public final ImmutableMultimap<Double, DetectionSection> detectionUpdatePositions;
    /** Keys are positions, values are a set of routes which state change when the train is at this position */
    public final ImmutableMultimap<Double, ReservationRoute> routeUpdatePositions;
    /** Set of positions where the state of at least one object changes */
    public final ImmutableSortedSet<Double> updatePositions;

    /** If the train position is in this range, we consider that the entity is occupied.
     * "from" is included, "until" is excluded */
    private record OccupationRange(double from, double until) {
        public boolean contains(double offset) {
            return from <= offset && offset < until;
        }
    }

    /** Constructor */
    private StandaloneState(
            NewTrainPath trainPath,
            Map<DetectionSection, OccupationRange> sectionOccupationRanges,
            Map<ReservationRoute, OccupationRange> routeOccupationRanges,
            ImmutableMultimap<Double, DetectionSection> detectionUpdatePositions,
            ImmutableMultimap<Double, ReservationRoute> routeUpdatePositions,
            ImmutableSortedSet<Double> updatePositions
    ) {
        this.trainPath = trainPath;
        this.sectionOccupationRanges = sectionOccupationRanges;
        this.routeOccupationRanges = routeOccupationRanges;
        this.detectionUpdatePositions = detectionUpdatePositions;
        this.routeUpdatePositions = routeUpdatePositions;
        this.updatePositions = updatePositions;
    }

    /** Make a standalone state from a train path and length */
    public static StandaloneState from(NewTrainPath trainPath, double trainLength) {
        var detectionRanges = initDetectionSectionRanges(trainPath, trainLength);
        var routeRanges = initRouteStateRanges(trainPath, trainLength);
        var detectionUpdatePositions = makeGenericUpdatePositions(detectionRanges);
        var routeUpdatePositions = makeGenericUpdatePositions(routeRanges);
        var updatePositions = makeUpdatePositions(detectionUpdatePositions, routeUpdatePositions);
        return new StandaloneState(
                trainPath,
                detectionRanges,
                routeRanges,
                detectionUpdatePositions,
                routeUpdatePositions,
                updatePositions
        );
    }

    /** Move the train to the given new offset */
    public void moveTrain(double newOffset) {
        currentOffset = newOffset;
    }

    @Override
    public DetectionSectionState getState(DetectionSection section) {
        if (isElementFree(sectionOccupationRanges, section))
            return new StandaloneDetectionSectionState(
                    DetectionSectionState.Summary.FREE,
                    null,
                    null,
                    section
            );
        else
            return new StandaloneDetectionSectionState(
                    DetectionSectionState.Summary.OCCUPIED,
                    NewTrainPath.getLastElementBefore(trainPath.routePath(), currentOffset).getInfraRoute(),
                    new StandaloneReservationTrain(),
                    section
            );
    }

    @Override
    public ReservationRouteState getState(ReservationRoute route) {
        if (!isElementFree(routeOccupationRanges, route)) {
            return new StandaloneReservationRouteState(
                    ReservationRouteState.Summary.OCCUPIED,
                    new StandaloneReservationTrain(),
                    route
            );
        } else {
            for (var otherRoute : route.getConflictingRoutes()) {
                if (!isElementFree(routeOccupationRanges, otherRoute))
                    return new StandaloneReservationRouteState(
                            ReservationRouteState.Summary.CONFLICT,
                            new StandaloneReservationTrain(),
                            otherRoute
                    );
            }
            return new StandaloneReservationRouteState(ReservationRouteState.Summary.FREE, null, route);
        }
    }

    /** Make a multimap of double -> T,
     * where keys are positions and values are objects that are updated at this position.
     * T is either ReservationRoute or DetectionSection */
    private static <T> ImmutableMultimap<Double, T> makeGenericUpdatePositions(
            Map<T, OccupationRange> ranges
    ) {
        var res = ImmutableMultimap.<Double, T>builder();
        for (var entry : ranges.entrySet()) {
            res.put(Math.max(0, entry.getValue().from), entry.getKey());
            res.put(entry.getValue().until, entry.getKey());
        }
        return res.build();
    }

    /** Lists all the positions where something is updated somewhere on the infra */
    private static ImmutableSortedSet<Double> makeUpdatePositions(
            ImmutableMultimap<Double, DetectionSection> detectionUpdatePositions,
            ImmutableMultimap<Double, ReservationRoute> routeUpdatePositions
    ) {
        var res = ImmutableSortedSet.<Double>naturalOrder();
        res.addAll(detectionUpdatePositions.keySet());
        res.addAll(routeUpdatePositions.keySet());
        return res.build();
    }

    /** Initializes the detection -> occupation range mapping */
    private static Map<DetectionSection, OccupationRange> initDetectionSectionRanges(
            NewTrainPath trainPath,
            double trainLength
    ) {
        return initRanges(trainPath.detectionSections(), trainPath.length(), trainLength);
    }

    /** Initializes the route -> occupation range mapping */
    private static Map<ReservationRoute, OccupationRange> initRouteStateRanges(
            NewTrainPath trainPath,
            double trainLength
    ) {
        var intermediateRes
                = initRanges(trainPath.routePath(), trainPath.length(), trainLength);
        // Converts the SignalingRoute keys into ReservationRoutes
        var res = new HashMap<ReservationRoute, OccupationRange>();
        for (var entry : intermediateRes.entrySet())
            res.put(entry.getKey().getInfraRoute(), entry.getValue());
        return res;
    }

    /** Initializes a mapping from T to occupation range.
     * (factorizes code from `initRouteStateRanges` and `initDetectionSectionRanges`) */
    private static <T> Map<T, OccupationRange> initRanges(
            ImmutableList<NewTrainPath.LocatedElement<T>> elements,
            double pathLength,
            double trainLength
    ) {
        var res = new HashMap<T, OccupationRange>();
        for (int i = 0; i < elements.size(); i++) {
            var element = elements.get(i);
            var begin = element.pathOffset();
            var end = pathLength;
            if (i < elements.size() - 1)
                end = elements.get(i + 1).pathOffset();
            end += trainLength;
            res.put(element.element(), new OccupationRange(begin, end));
        }
        return res;
    }

    /** Returns true if the given element is free */
    private <T> boolean isElementFree(Map<T, OccupationRange> map, T element) {
        var range = map.getOrDefault(element, null);
        if (range == null) {
            // The object isn't on the train path, it's always free
            return true;
        }
        return !range.contains(currentOffset);
    }
}
