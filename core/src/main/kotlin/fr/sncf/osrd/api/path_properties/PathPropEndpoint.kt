package fr.sncf.osrd.api.path_properties

import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.implementations.buildChunkPath
import fr.sncf.osrd.path.implementations.buildTrainPathFromChunkPath
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Offset
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class PathPropEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request?): Response {
        return try {
            val body = RqPrint(req).printBody()
            val request =
                pathPropRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            val chunkPath = makeChunkPath(infra.rawInfra, request.trackSectionRanges)
            val trainPath = buildTrainPathFromChunkPath(infra.rawInfra, infra.blockInfra, chunkPath)
            val res = makePathPropResponse(trainPath, infra.rawInfra)

            RsJson(RsWithBody(pathPropResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    fun makeChunkPath(
        rawInfra: RawSignalingInfra,
        trackRanges: List<DirectionalTrackRange>,
    ): ChunkPath {
        val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
        val firstRange = trackRanges[0]
        var startOffset = firstRange.begin.distance
        if (firstRange.direction == EdgeDirection.STOP_TO_START) {
            val firstTrackId = rawInfra.getTrackSectionFromName(firstRange.trackSection)!!
            startOffset = rawInfra.getTrackSectionLength(firstTrackId) - firstRange.end
        }
        var endOffset = startOffset
        for (trackRange in trackRanges) {
            endOffset += trackRange.end - trackRange.begin
            val trackId = rawInfra.getTrackSectionFromName(trackRange.trackSection)!!
            val dir =
                if (trackRange.direction == EdgeDirection.START_TO_STOP) Direction.INCREASING
                else Direction.DECREASING
            val chunksOnTrack =
                if (dir == Direction.INCREASING) rawInfra.getTrackSectionChunks(trackId)
                else rawInfra.getTrackSectionChunks(trackId).reversed()
            for (chunk in chunksOnTrack) chunks.add(DirStaticIdx(chunk, dir))
        }
        return buildChunkPath(rawInfra, chunks, Offset(startOffset), Offset(endOffset))
    }
}
