package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: MutableList<Envelope>
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead()
            .map { explorer -> InfraExplorerWithEnvelopeImpl(explorer, ArrayList(envelopes)) }
    }

    override fun getFullEnvelope(): EnvelopeTimeInterpolate {
        return EnvelopeConcat.from(envelopes)
    }

    override fun getLastEnvelope(): Envelope {
        return envelopes.last()
    }

    override fun addEnvelope(envelope: Envelope) {
        envelopes.add(envelope)
    }

    override fun clone(): InfraExplorerWithEnvelope {
        return InfraExplorerWithEnvelopeImpl(infraExplorer.clone(), ArrayList(envelopes))
    }

    override fun moveForward() {
        throw RuntimeException("moveForward can't be used for InfraExplorerWithEnvelope")
    }
}
