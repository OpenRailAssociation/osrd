package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirementAutomaton
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

data class BlockAvailability(
    val fullInfra: FullInfra,
    val rollingStock: RollingStock,
    val requirements: Map<ZoneId, List<SpacingRequirement>>
) : GenericBlockAvailability() {

    private data class ZoneResourceUse(
        override val startOffset: Offset<Path>,
        override val endOffset: Offset<Path>,
        override val startTime: Double,
        override val endTime: Double,
        val zoneId: ZoneId,
    ) : ResourceUse

    override fun generateResourcesForPath(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>
    ): List<ResourceUse> {
        // TODO: discuss things here
        // We're supposed to return null at some point (when more lookahead is required)
        // Instantiating an automaton each time is probably wrong
        val incrementalPath = infraExplorer.getIncrementalPath()
        val envelopeAdapter =
            IncrementalRequirementEnvelopeAdapter(
                incrementalPath,
                rollingStock,
                infraExplorer.getFullEnvelope()
            )
        val spacingGenerator =
            SpacingRequirementAutomaton(
                fullInfra.rawInfra,
                fullInfra.loadedSignalInfra,
                fullInfra.blockInfra,
                fullInfra.signalingSimulator,
                envelopeAdapter,
                incrementalPath
            )
        val res = mutableListOf<ResourceUse>()
        val resources = spacingGenerator.processPathUpdate()
        for (resource in resources) {
            val resourceStartOffset = getEnvelopeOffsetFromTime(infraExplorer, resource.beginTime)
            val resourceEndOffset = getEnvelopeOffsetFromTime(infraExplorer, resource.endTime)
            if (resourceStartOffset > endOffset || resourceEndOffset < startOffset)
                continue // The resource use is outside the considered range
            res.add(
                ZoneResourceUse(
                    resourceStartOffset,
                    resourceEndOffset,
                    resource.beginTime,
                    resource.endTime,
                    fullInfra.rawInfra.getZoneFromName(resource.zone)
                )
            )
        }
        return res
    }

    override fun getScheduledResources(
        infraExplorer: InfraExplorerWithEnvelope,
        resource: ResourceUse
    ): List<ResourceUse> {
        val res = mutableListOf<ResourceUse>()
        val zoneResourceUse = resource as ZoneResourceUse
        for (scheduledRequirement in requirements[zoneResourceUse.zoneId] ?: listOf()) {
            val resourceStartOffset =
                getEnvelopeOffsetFromTime(infraExplorer, scheduledRequirement.beginTime)
            val resourceEndOffset =
                getEnvelopeOffsetFromTime(infraExplorer, scheduledRequirement.endTime)
            res.add(
                ZoneResourceUse(
                    resourceStartOffset,
                    resourceEndOffset,
                    scheduledRequirement.beginTime,
                    scheduledRequirement.endTime,
                    zoneResourceUse.zoneId
                )
            )
        }
        return res
    }

    /**
     * Turns a time into an offset on an envelope with a binary search. Can be optimized if needed.
     */
    private fun getEnvelopeOffsetFromTime(
        explorer: InfraExplorerWithEnvelope,
        time: Double
    ): Offset<Path> {
        val envelope = explorer.getFullEnvelope()
        val search = DoubleBinarySearch(envelope.beginPos, envelope.endPos, time, 2.0, false)
        while (!search.complete()) search.feedback(envelope.interpolateTotalTimeClamp(search.input))
        return explorer
            .getIncrementalPath()
            .fromTravelledPath(Offset(Distance.fromMeters(search.result)))
    }
}

fun buildBlockAvailability(
    infra: FullInfra,
    rollingStock: RollingStock,
    rawRequirements: Collection<SpacingRequirement>
): BlockAvailability {
    val requirements = mutableMapOf<ZoneId, MutableList<SpacingRequirement>>()
    for (requirement in rawRequirements) {
        val zone = infra.rawInfra.getZoneFromName(requirement.zone)
        requirements.putIfAbsent(zone, mutableListOf())
        requirements[zone]!!.add(requirement)
    }
    return BlockAvailability(infra, rollingStock, requirements)
}
