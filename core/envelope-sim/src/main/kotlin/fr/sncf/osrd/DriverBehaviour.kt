package fr.sncf.osrd

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import kotlin.math.max
import kotlin.math.min

data class DriverBehaviour(
    val acceleratingPostponementOffset: Double = 50.0,
    val brakingAnticipationOffset: Double = 100.0,
) {
    /** Applies the driver behavior to the MRSP, adding reaction time for MRSP changes */
    fun applyToMRSP(mrsp: Envelope): Envelope {
        val builder = MRSPEnvelopeBuilder()
        val totalLength = mrsp.totalDistance
        for (part in mrsp) {
            var begin = part.beginPos
            var end = part.endPos
            // compute driver behaviour offsets
            begin -= this.brakingAnticipationOffset
            end += this.acceleratingPostponementOffset
            begin = max(0.0, begin)
            end = min(totalLength, end)
            val speed = part.maxSpeed

            builder.addPart(
                EnvelopePart.generateTimes(
                    listOf(
                        EnvelopeProfile.CONSTANT_SPEED,
                        MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT
                    ),
                    doubleArrayOf(begin, end),
                    doubleArrayOf(speed, speed)
                )
            )
        }
        return builder.build()
    }
}
