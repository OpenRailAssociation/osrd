package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch
import com.google.common.collect.ImmutableList
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import java.util.stream.Collectors

data class TrainPath(
    @JvmField val routePath: ImmutableList<LocatedElement<SignalingRoute>>,
    @JvmField val trackRangePath: ImmutableList<LocatedElement<TrackRangeView>>,
    @JvmField val detectors: ImmutableList<LocatedElement<DiDetector>>,
    @JvmField val detectionSections: ImmutableList<LocatedElement<DetectionSection>>,
    @JvmField val length: Double
) {
    /** An element located with the offset from the start of the path.
     * For ranges and routes, it's the position of the start of the object
     * (negative if the path start is in the middle of an object).  */
    data class LocatedElement<T>(@JvmField val pathOffset: Double, @JvmField val element: T)

    /** Converts a track location into an offset on the path.
     * Note: using this should be avoided whenever possible, it prevents paths with loops  */
    fun convertTrackLocation(location: TrackLocation?): Double {
        for (track in trackRangePath) if (track.element.contains(location)) return track.pathOffset + track.element.offsetOf(
            location
        )
        throw InvalidSchedule("TrackLocation isn't included in the path")
    }

    /** Returns the location at the given offset  */
    fun findLocation(pathOffset: Double): TrackLocation {
        var element = getLastLocatedElementBefore(trackRangePath, pathOffset)
        if (element.element.track.getEdge() is SwitchBranch) {
            // This case can happen when pathOffset is exactly on a switch, we want the next range in that case
            element = trackRangePath.get(trackRangePath.indexOf(element) + 1)
        }
        return element.element.offsetLocation(pathOffset - element.pathOffset)
    }

    companion object {
        /** Utility function, converts a list of LocatedElement into a list of element  */
        @JvmStatic fun <T> removeLocation(list: ImmutableList<LocatedElement<T>>): List<T> {
            return list.stream()
                .map { x -> x.element }
                .collect(Collectors.toList())
        }

        /** Utility function, returns the last element with offset <= the given offset.
         * For range objects (route / sections), it returns the element containing the offset.  */
        @JvmStatic fun <T> getLastElementBefore(list: ImmutableList<LocatedElement<T>>, offset: Double): T {
            return getLastLocatedElementBefore(list, offset).element
        }

        /** Utility function, returns the last located element with offset <= the given offset.
         * For range objects (route / sections), it returns the element containing the offset.  */
        @JvmStatic fun <T> getLastLocatedElementBefore(
            list: ImmutableList<LocatedElement<T>>,
            offset: Double
        ): LocatedElement<T> {
            for (i in list.indices) {
                val e = list[i]
                if (e.pathOffset > offset && i > 0) return list[i - 1]
                if (e.pathOffset >= offset) return e
            }
            return list[list.size - 1]
        }
    }
}