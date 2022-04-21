package fr.sncf.osrd.dyn_infra.implementation.standalone

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.dyn_infra.api.DetectionSectionState
import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import fr.sncf.osrd.dyn_infra.api.TrainPath
import java.util.stream.Collectors
import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.ImmutableSortedSet
import fr.sncf.osrd.dyn_infra.api.InfraStateView
import java.util.HashMap
import com.google.common.collect.ImmutableList
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.dyn_infra.api.TrainPath.LocatedElement

/** A simple implementation of InfraStateView that supports only a single train.  */
@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
class StandaloneState private constructor(
    /** Train path  */
    private val trainPath: TrainPath,
    /** For each detection section, the train position range where it is occupied  */
    private val sectionOccupationRanges: Map<DetectionSection, OccupationRange>,
    /** For each route, the train position range where it is occupied  */
    private val routeOccupationRanges: Map<ReservationRoute, OccupationRange>,
    /** Set of route IDs on the path. Those routes are considered RESERVED instead of FREE  */
    private val routesOnPath: Set<String>,
    /** Keys are positions, values are a set of sections which state change when the train is at this position  */
    @JvmField val detectionUpdatePositions: ImmutableMultimap<Double, DetectionSection>,
    /** Keys are positions, values are a set of routes which state change when the train is at this position  */
    @JvmField val routeUpdatePositions: ImmutableMultimap<Double, ReservationRoute>,
    /** Set of positions where the state of at least one object changes  */
    @JvmField val updatePositions: ImmutableSortedSet<Double>
) : InfraStateView {
    /** Current offset of the train  */
    private var currentOffset = 0.0

    /** If the train position is in this range, we consider that the entity is occupied.
     * "from" is included, "until" is excluded  */
    private data class OccupationRange(val from: Double, val until: Double) {
        operator fun contains(offset: Double): Boolean {
            return from <= offset && offset < until
        }
    }

    /** Move the train to the given new offset  */
    fun moveTrain(newOffset: Double) {
        currentOffset = newOffset
    }

    override fun getState(section: DetectionSection): DetectionSectionState {
        return if (isElementFree(sectionOccupationRanges, section)) StandaloneDetectionSectionState(
            DetectionSectionState.Summary.FREE,
            null,
            null,
            section
        ) else StandaloneDetectionSectionState(
            DetectionSectionState.Summary.OCCUPIED,
            TrainPath.getLastElementBefore(trainPath.routePath, currentOffset).infraRoute,
            StandaloneReservationTrain(),
            section
        )
    }

    override fun getState(route: ReservationRoute): ReservationRouteState {
        return if (!isElementFree(routeOccupationRanges, route)) {
            StandaloneReservationRouteState(
                ReservationRouteState.Summary.OCCUPIED,
                StandaloneReservationTrain(),
                route
            )
        } else {
            for (otherRoute in route.conflictingRoutes) {
                if (!isElementFree(routeOccupationRanges, otherRoute))
                    return StandaloneReservationRouteState(
                        ReservationRouteState.Summary.CONFLICT,
                        StandaloneReservationTrain(),
                        otherRoute
                    )
            }
            if (routesOnPath.contains(route.id)) StandaloneReservationRouteState(
                ReservationRouteState.Summary.RESERVED,
                StandaloneReservationTrain(), route
            ) else StandaloneReservationRouteState(
                ReservationRouteState.Summary.FREE,
                null, route
            )
        }
    }

    /** Returns true if the given element is free  */
    private fun <T> isElementFree(map: Map<T, OccupationRange?>, element: T): Boolean {
        val range = map.getOrDefault(element, null)
            ?: // The object isn't on the train path, it's always free
            return true
        return !range.contains(currentOffset)
    }

    companion object {
        /** Make a standalone state from a train path and length  */
        @JvmStatic
        fun from(trainPath: TrainPath, trainLength: Double): StandaloneState {
            val detectionRanges = initDetectionSectionRanges(trainPath, trainLength)
            val routeRanges = initRouteStateRanges(trainPath, trainLength)
            val detectionUpdatePositions = makeGenericUpdatePositions(detectionRanges)
            val routeUpdatePositions = makeGenericUpdatePositions(routeRanges)
            val updatePositions = makeUpdatePositions(detectionUpdatePositions, routeUpdatePositions)
            val routesOnPath = trainPath.routePath.stream()
                .map { r -> r.element.infraRoute.id }
                .collect(Collectors.toSet())
            return StandaloneState(
                trainPath,
                detectionRanges,
                routeRanges,
                routesOnPath,
                detectionUpdatePositions,
                routeUpdatePositions,
                updatePositions
            )
        }

        /** Make a multimap of double -> T,
         * where keys are positions and values are objects that are updated at this position.
         * T is either ReservationRoute or DetectionSection  */
        private fun <T> makeGenericUpdatePositions(
            ranges: Map<T, OccupationRange>
        ): ImmutableMultimap<Double, T> {
            val res = ImmutableMultimap.builder<Double, T>()
            for ((key, value) in ranges) {
                res.put(0.0.coerceAtLeast(value.from), key)
                res.put(value.until, key)
            }
            return res.build()
        }

        /** Lists all the positions where something is updated somewhere on the infra  */
        private fun makeUpdatePositions(
            detectionUpdatePositions: ImmutableMultimap<Double, DetectionSection>,
            routeUpdatePositions: ImmutableMultimap<Double, ReservationRoute>
        ): ImmutableSortedSet<Double> {
            val res = ImmutableSortedSet.naturalOrder<Double>()
            res.addAll(detectionUpdatePositions.keySet())
            res.addAll(routeUpdatePositions.keySet())
            return res.build()
        }

        /** Initializes the detection -> occupation range mapping  */
        private fun initDetectionSectionRanges(
            trainPath: TrainPath,
            trainLength: Double
        ): Map<DetectionSection, OccupationRange> {
            return initRanges(trainPath.detectionSections, trainPath.length, trainLength)
        }

        /** Initializes the route -> occupation range mapping  */
        private fun initRouteStateRanges(
            trainPath: TrainPath,
            trainLength: Double
        ): Map<ReservationRoute, OccupationRange> {
            val intermediateRes = initRanges(trainPath.routePath, trainPath.length, trainLength)
            // Converts the SignalingRoute keys into ReservationRoutes
            val res = HashMap<ReservationRoute, OccupationRange>()
            for ((key, value) in intermediateRes)
                res[key.infraRoute] = value
            return res
        }

        /** Initializes a mapping from T to occupation range.
         * (factorizes code from `initRouteStateRanges` and `initDetectionSectionRanges`)  */
        private fun <T> initRanges(
            elements: ImmutableList<LocatedElement<T>>,
            pathLength: Double,
            trainLength: Double
        ): Map<T, OccupationRange> {
            val res = HashMap<T, OccupationRange>()
            for (i in elements.indices) {
                val element = elements[i]
                val begin = element.pathOffset
                var end = pathLength
                if (i < elements.size - 1)
                    end = elements[i + 1].pathOffset
                end += trainLength
                res[element.element] = OccupationRange(begin, end)
            }
            return res
        }
    }
}