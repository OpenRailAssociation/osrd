package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate

fun TrainState.toEnvelopePoint(): EnvelopeTimeInterpolate.EnvelopePoint {
    return EnvelopeTimeInterpolate.EnvelopePoint(
        time.seconds,
        speed.metersPerSecond,
        position.meters,
    )
}
