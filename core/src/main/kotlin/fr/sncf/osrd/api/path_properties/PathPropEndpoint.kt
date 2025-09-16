package fr.sncf.osrd.api.path_properties

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.path.implementations.buildTrainPathFromChunkPath
import fr.sncf.osrd.utils.makeChunkPath
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
            val pathProps = buildTrainPathFromChunkPath(infra.rawInfra, infra.blockInfra, chunkPath)
            val res = makePathPropResponse(pathProps, infra.rawInfra)

            RsJson(RsWithBody(pathPropResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}
