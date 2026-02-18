package fr.sncf.osrd.api.path_properties

import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.path.implementations.PartialDirTrackRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromTracks
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.reporting.exceptions.OSRDError.newUnknownTrackSectionError
import fr.sncf.osrd.sim_infra.api.DirTrackSectionId
import fr.sncf.osrd.toDirection
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.forceDirected
import fr.sncf.osrd.utils.units.toDirected

class PathPropEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
        return try {
            val body = req.body()
            val request =
                pathPropRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            val trainPath = buildTrainPath(infra, request.trackSectionRanges)
            val res = makePathPropResponse(trainPath, infra.rawInfra)

            RsJson(RsWithBody(pathPropResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    /** Build a train path from the request's track ranges. */
    private fun buildTrainPath(
        infra: FullInfra,
        trackRanges: List<DirectionalTrackRange>,
    ): TrainPath {
        val partialTrackRanges =
            trackRanges.map {
                val track =
                    infra.rawInfra.getTrackSectionFromName(it.trackSection)
                        ?: throw newUnknownTrackSectionError(it.trackSection)
                val dir = it.direction.toDirection()
                val trackLength = infra.rawInfra.getTrackSectionLength(track)
                val begin = it.begin.toDirected(trackLength, dir)
                val end = it.end.toDirected(trackLength, dir)
                PartialDirTrackRange(
                    DirTrackSectionId(track, dir),
                    min(begin, end),
                    max(begin, end),
                    trackLength.forceDirected(),
                )
            }
        val trackRanges = buildRangeList(partialTrackRanges)
        return buildTrainPathFromTracks(infra.rawInfra, infra.blockInfra, trackRanges)
    }
}
