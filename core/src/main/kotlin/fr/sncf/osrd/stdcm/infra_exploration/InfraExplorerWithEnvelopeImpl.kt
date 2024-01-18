package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.units.Offset

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: MutableList<EnvelopeTimeInterpolate>
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead()
            .map { explorer -> InfraExplorerWithEnvelopeImpl(explorer, ArrayList(envelopes)) }
    }

    override fun getFullEnvelope(): EnvelopeTimeInterpolate {
        return EnvelopeConcat.from(envelopes)
    }

    override fun getLastEnvelope(): EnvelopeTimeInterpolate {
        return envelopes.last()
    }

    override fun addEnvelope(envelope: EnvelopeTimeInterpolate): InfraExplorerWithEnvelope {
        envelopes.add(envelope)
        return this
    }

    override fun interpolateTimeClamp(pathOffset: Offset<Path>): Double {
        return getFullEnvelope().interpolateTotalTimeClamp(
            getIncrementalPath().toTravelledPath(pathOffset).distance.meters
        )
    }

    override fun clone(): InfraExplorerWithEnvelope {
        return InfraExplorerWithEnvelopeImpl(infraExplorer.clone(), ArrayList(envelopes))
    }
}
