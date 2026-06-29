package fr.sncf.osrd.api.conflicts

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.api.convertWorkScheduleMap
import fr.sncf.osrd.api.parseTrainsRequirements
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.conflicts.Conflict
import fr.sncf.osrd.conflicts.Requirements
import fr.sncf.osrd.conflicts.detectConflicts
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.units.seconds

class ConflictDetectionEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
        return try {
            val body = req.body()
            val request =
                conflictRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            if (request.trainsRequirements.isEmpty()) {
                return RsJson(
                    RsWithBody(conflictResponseAdapter.toJson(ConflictDetectionResponse(listOf())))
                )
            }

            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            val requirements = mutableListOf<Requirements>()
            if (request.workSchedules != null) {
                val convertedWorkSchedules =
                    convertWorkScheduleMap(
                        infra.rawInfra,
                        request.workSchedules.workScheduleRequirements,
                    )
                requirements.addAll(convertedWorkSchedules)
            }
            val trainRequirements =
                parseTrainsRequirements(infra.rawInfra, request.trainsRequirements)
            requirements.addAll(trainRequirements)
            val conflicts = detectConflicts(requirements)
            val res = makeConflictDetectionResponse(infra.rawInfra, conflicts)

            RsJson(RsWithBody(conflictResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun makeConflictDetectionResponse(
    infra: RawSignalingInfra,
    conflicts: Collection<Conflict>,
): ConflictDetectionResponse {
    return ConflictDetectionResponse(
        conflicts.map {
            ConflictResponse(
                it.trainIds,
                it.workScheduleIds,
                it.startTime.seconds,
                (it.endTime - it.startTime).seconds,
                it.conflictType,
                it.requirements.map { requirement ->
                    ConflictRequirement(
                        infra.getZoneName(requirement.zone),
                        requirement.startTime.seconds,
                        (requirement.endTime - requirement.startTime).seconds,
                    )
                },
            )
        }
    )
}
