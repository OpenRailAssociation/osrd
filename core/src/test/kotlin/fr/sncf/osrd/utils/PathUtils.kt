package fr.sncf.osrd.utils

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.implementations.PartialDirTrackRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromTracks
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.reporting.exceptions.OSRDError.newUnknownTrackSectionError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.forceDirected

/** Build a path from track ids */
fun pathFromTracks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    trackNames: List<String>,
    dir: Direction,
    start: Distance,
    end: Distance,
    backtrackLocations: List<Offset<PhysicsPath>>,
    electricalProfileMapping: ElectricalProfileMapping? = null,
    routeNames: List<String>? = null,
): TrainPath {
    val partialTrackRanges = trackNames.map { trackName ->
        val track =
            rawInfra.getTrackSectionFromName(trackName)
                ?: throw newUnknownTrackSectionError(trackName)
        val trackLength = rawInfra.getTrackSectionLength(track)
        PartialDirTrackRange(
            DirTrackSectionId(track, dir),
            Offset.zero(),
            trackLength.forceDirected(),
            trackLength.forceDirected(),
        )
    }
    val trackRanges = buildRangeList(partialTrackRanges)
    return buildTrainPathFromTracks(
        rawInfra,
        blockInfra,
        trackRanges.subRange(Offset(start), Offset(end)),
        backtrackLocations,
        electricalProfileMapping = electricalProfileMapping,
        routeNames = routeNames,
    )
}

fun pathFromTracks(
    infra: FullInfra,
    trackNames: List<String>,
    dir: Direction,
    start: Distance,
    end: Distance,
    backtrackLocations: List<Offset<PhysicsPath>> = listOf(),
    electricalProfileMapping: ElectricalProfileMapping? = null,
    routeNames: List<String>? = null,
): TrainPath {
    return pathFromTracks(
        infra.rawInfra,
        infra.blockInfra,
        trackNames,
        dir,
        start,
        end,
        backtrackLocations,
        electricalProfileMapping = electricalProfileMapping,
        routeNames = routeNames,
    )
}
