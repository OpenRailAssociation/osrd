package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.utils.areSpeedsEqual
import kotlin.math.withSign

class IntegrationStep
private constructor(
    @JvmField val timeDelta: Double,
    @JvmField val positionDelta: Double,
    @JvmField val startSpeed: Double,
    @JvmField val endSpeed: Double,
    @JvmField val acceleration: Double,
    @JvmField val directionSign: Double,
) {
    companion object {
        /**
         * Create a new integration step which always keeps positive speeds, from a step which may
         * not
         */
        @JvmStatic
        fun fromNaiveStep(
            timeDelta: Double,
            positionDelta: Double,
            startSpeed: Double,
            endSpeed: Double,
            acceleration: Double,
            directionSign: Double,
        ): IntegrationStep {
            // if the end of the step dips below 0, cut the step in half
            var timeDelta = timeDelta
            var positionDelta = positionDelta
            var endSpeed = endSpeed
            if (endSpeed < 0.0) {
                assert(directionSign * acceleration < 0.0)
                endSpeed = 0.0
                // generic formula:
                // timeDelta = (endSpeed - startSpeed) / (directionSign * acceleration);
                timeDelta = -startSpeed / (directionSign * acceleration)
                positionDelta = startSpeed * timeDelta + 0.5 * acceleration * timeDelta * timeDelta
                positionDelta = positionDelta.withSign(directionSign)
            }
            assert(
                areSpeedsEqual(endSpeed, (startSpeed + directionSign * acceleration * timeDelta))
            )
            return IntegrationStep(
                timeDelta,
                positionDelta,
                startSpeed,
                endSpeed,
                acceleration,
                directionSign,
            )
        }
    }
}
