package fr.sncf.osrd.standalone_sim.result

import com.squareup.moshi.Json
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

class ResultPosition
private constructor(time: Double, pathOffset: Double, trackSection: String?, offset: Double) {
    val time: Double

    @Json(name = "track_section") val trackSection: String?

    val offset: Double

    @Json(name = "path_offset") val pathOffset: Double

    init {
        this.time = time
        this.pathOffset = pathOffset
        this.trackSection = trackSection
        this.offset = offset
    }

    companion object {
        /** Create a ResultPosition */
        fun from(
            time: Double,
            pathOffset: Double,
            path: TrainPath,
            rawInfra: RawSignalingInfra,
        ): ResultPosition {
            val location = path.getTrackLocationAtOffset(Offset(pathOffset.meters))
            return ResultPosition(
                time,
                pathOffset,
                rawInfra.getTrackSectionName(location.trackId),
                location.offset.meters,
            )
        }
    }
}
