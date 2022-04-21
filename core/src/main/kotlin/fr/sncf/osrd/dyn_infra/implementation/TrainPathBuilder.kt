package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.exceptions.OSRDError
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import kotlin.Throws
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation
import fr.sncf.osrd.dyn_infra.api.TrainPath
import com.google.common.collect.ImmutableList
import fr.sncf.osrd.dyn_infra.api.TrainPath.LocatedElement
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import java.lang.RuntimeException
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import java.util.ArrayList
import kotlin.math.abs

object TrainPathBuilder {
    /** Build Train Path from routes, a starting and ending location  */
    @Throws(InvalidSchedule::class)
    @JvmStatic fun from(
        routePath: List<SignalingRoute>,
        startLocation: TrackLocation,
        endLocation: TrackLocation
    ): TrainPath {
        val trackSectionPath = try {
            createTrackRangePath(routePath, startLocation, endLocation)
        } catch (e: RuntimeException) {
            throw InvalidSchedule(e.message)
        }
        val detectors = createDetectorPath(trackSectionPath)
        var length = 0.0
        for (track in trackSectionPath)
            length += track.element.length
        val locatedRoutePath = makeLocatedRoutePath(routePath, startLocation)
        val trainPath = TrainPath(
            locatedRoutePath,
            trackSectionPath,
            detectors,
            makeDetectionSections(locatedRoutePath, length),
            length
        )
        validate(trainPath)
        return trainPath
    }

    /** Build Train Path from an RailJSON train path  */
    @Throws(InvalidSchedule::class)
    @JvmStatic fun from(infra: SignalingInfra, rjsTrainPath: RJSTrainPath): TrainPath {
        return try {
            val routePath = ArrayList<SignalingRoute>()
            for (rjsRoutePath in rjsTrainPath.routePath) {
                val infraRoute = infra.reservationRouteMap[rjsRoutePath.route.id.id]
                    ?: throw InvalidSchedule(String.format("Can't find route %s", rjsRoutePath.route.id.id))
                val signalingRoutes = infra.routeMap[infraRoute]
                // TODO: add an enum to determine the signalization type
                routePath.add(signalingRoutes.stream().findFirst().orElseThrow())
            }
            val rjsStartTrackRange = rjsTrainPath.routePath[0].trackSections[0]
            val startLocation = TrackLocation(
                infra.getTrackSection(rjsStartTrackRange.track.id.id),
                rjsStartTrackRange.begin
            )
            val rjsEndRoutePath = rjsTrainPath.routePath[rjsTrainPath.routePath.size - 1]
            val rjsEndTrackRange = rjsEndRoutePath.trackSections[rjsEndRoutePath.trackSections.size - 1]
            val endLocation = TrackLocation(
                infra.getTrackSection(rjsEndTrackRange.track.id.id),
                rjsEndTrackRange.end
            )
            from(routePath, startLocation, endLocation)
        } catch (e: OSRDError) {
            throw InvalidSchedule(e.message)
        }
    }

    /** check that everything make sense  */
    private fun validate(path: TrainPath) {
        assert(!path.routePath.isEmpty()) { "empty route path" }
        assert(!path.detectionSections.isEmpty()) { "no detection section on path" }
        assert(!path.trackRangePath.isEmpty()) { "empty track range path" }
        assert(path.length > 0) { "length must be strictly positive" }
        validateDetectionSections(path)

        // TODO checks that the track ranges are properly connected
        // But this would require an actual infra, which technically isn't required otherwise
    }

    /** Checks that the detectors and detection section transitions are consistent  */
    private fun validateDetectionSections(path: TrainPath) {
        assert(path.detectionSections.size > 0) { "no detection section" }
        var detSectionIndex = 0
        val firstOffset = path.detectionSections[0].pathOffset
        if (firstOffset < 0 || (firstOffset == 0.0 && path.detectors.size > 0 && path.detectors[0].pathOffset > 0))
            detSectionIndex = 1
        for (detectorIndex in 0 until path.detectors.size) {
            assert(detSectionIndex <= path.detectionSections.size) { "missing detection sections" }
            if (detSectionIndex < path.detectionSections.size) {
                assert(abs(path.detectors[detectorIndex].pathOffset
                            - path.detectionSections[detSectionIndex].pathOffset) < 1e-5)
                { "detector / section offset mismatch" }
            }
            detSectionIndex++
        }
        assert(abs(path.detectionSections.size - path.detectors.size) <= 1)
        { "Detection section size is inconsistent" }
    }

    /** Creates the list of located routes  */
    private fun makeLocatedRoutePath(
        routePath: List<SignalingRoute>,
        startLocation: TrackLocation
    ): ImmutableList<LocatedElement<SignalingRoute>> {
        val res = ImmutableList.builder<LocatedElement<SignalingRoute>>()
        val offsetOnFirstRoute = offsetFromStartOfPath(
            routePath[0].infraRoute.trackRanges,
            startLocation
        )
        var offset = -offsetOnFirstRoute
        if (abs(offset) == 0.0)
            offset = 0.0 // avoids the annoying -0
        for (route in routePath) {
            res.add(LocatedElement(offset, route))
            offset += route.infraRoute.length
        }
        return res.build()
    }

    /** Returns the distance between the beginning of the list of ranges and the given location  */
    private fun offsetFromStartOfPath(path: ImmutableList<TrackRangeView>, location: TrackLocation): Double {
        var offset = 0.0
        for (range in path) {
            if (range.contains(location))
                return offset + range.offsetOf(location)
            offset += range.length
        }
        throw RuntimeException("Location isn't in the given path")
    }

    /** Creates a list of located directed detectors on the path  */
    private fun createDetectorPath(
        trackSectionPath: ImmutableList<LocatedElement<TrackRangeView>>
    ): ImmutableList<LocatedElement<DiDetector>> {
        val res = ArrayList<LocatedElement<DiDetector>>()
        var offset = 0.0
        for (range in trackSectionPath) {
            for (detector in range.element.detectors) {
                if (detector.element() != null) addIfDifferent(
                    res, LocatedElement(
                        offset + detector.offset,
                        detector.element.getDiDetector(range.element.track.direction)
                    )
                )
            }
            offset += range.element.length
        }
        return ImmutableList.copyOf(res)
    }

    /** Creates the list of detection sections on the path  */
    private fun makeDetectionSections(
        routePath: ImmutableList<LocatedElement<SignalingRoute>>,
        pathLength: Double
    ): ImmutableList<LocatedElement<DetectionSection>> {
        val res = ArrayList<LocatedElement<DetectionSection>>()
        var offset = routePath[0].pathOffset
        for (locatedRoute in routePath) {
            val route = locatedRoute.element
            for (range in route.infraRoute.trackRanges) {
                for (detector in range.detectors) {
                    val diDetector = detector.element.getDiDetector(range.track.direction)
                    val detectionSection = diDetector.detector.getNextDetectionSection(diDetector.direction)
                    if (detectionSection == null)
                        continue
                    addIfDifferent(res, LocatedElement(offset + detector.offset, detectionSection))
                }
                offset += range.length
            }
        }

        // Remove the first sections until only one start with a negative offset (the one we start on)
        while (res.size > 1 && res[1].pathOffset < 0)
            res.removeAt(0)

        // Remove the sections that start after the end of the path
        res.removeIf { section -> section.pathOffset >= pathLength }
        return ImmutableList.copyOf(res)
    }

    /** Creates the lists of track ranges  */
    private fun createTrackRangePath(
        routePath: List<SignalingRoute>,
        startLocation: TrackLocation,
        endLocation: TrackLocation
    ): ImmutableList<LocatedElement<TrackRangeView>> {
        val res = ArrayList<LocatedElement<TrackRangeView>>()
        var offset = 0.0
        var reachedStart = false
        var reachedEnd = false
        for (i in routePath.indices) {
            val signalingRoute = routePath[i]
            val route = signalingRoute.infraRoute
            for (range in route.trackRanges) {
                @Suppress("NAME_SHADOWING") var range = range
                if (!reachedStart) {
                    if (!range.contains(startLocation))
                        continue
                    reachedStart = true
                    range = range.truncateBegin(startLocation.offset())
                }
                // We have to check if we're on the last route to avoid problems with looping paths
                if (i == routePath.size - 1 && range.contains(endLocation)) {
                    range = range.truncateEnd(endLocation.offset())
                    reachedEnd = true
                }
                res.add(LocatedElement(offset, range))
                offset += range.length
                if (reachedEnd)
                    break
            }
        }
        assert(reachedStart) { "Start location isn't included in the route graph" }
        assert(reachedEnd) { "End location isn't included in the route graph" }
        return ImmutableList.copyOf(res)
    }

    /** Adds a located element if it's not already the last on the list  */
    private fun <T> addIfDifferent(
        list: MutableList<LocatedElement<T>>,
        element: LocatedElement<T>
    ) {
        if (list.isEmpty() || list[list.size - 1].element !== element.element)
            list.add(element)
    }
}