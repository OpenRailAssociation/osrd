package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

data class BlockAvailability(
    val fullInfra: FullInfra,
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
        TODO("a pain for the rebase, to be deleted anyway")
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
