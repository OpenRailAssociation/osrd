package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope_sim.IntegrationStep;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class IntegrationStepTest {
    @Test
    public void negativeSpeedForward() {
        var initialTimeDelta = 1;
        var startSpeed = 1;
        var acceleration = -2;
        var directionSign = 1;
        var endSpeed = startSpeed + initialTimeDelta * acceleration * directionSign;
        var initialPositionDelta = directionSign * (startSpeed * initialTimeDelta
                + 0.5 * acceleration * initialTimeDelta * initialTimeDelta);
        var step = IntegrationStep.fromNaiveStep(initialTimeDelta, initialPositionDelta, startSpeed,
                endSpeed, acceleration, directionSign);
        assertEquals(0, step.endSpeed);
        var expectedEndSpeed =
                step.startSpeed + step.timeDelta * step.acceleration * step.directionSign;
        assertEquals(step.endSpeed, expectedEndSpeed);
        assertTrue(step.timeDelta < initialTimeDelta);
        assertTrue(directionSign * step.positionDelta > 0);
    }

    @Test
    public void negativeSpeedBackward() {
        var initialTimeDelta = 1;
        var startSpeed = 1;
        var acceleration = 2;
        var directionSign = -1;
        var endSpeed = startSpeed + initialTimeDelta * acceleration * directionSign;
        var initialPositionDelta = directionSign * (startSpeed * initialTimeDelta
                + 0.5 * acceleration * initialTimeDelta * initialTimeDelta);
        var step = IntegrationStep.fromNaiveStep(initialTimeDelta, initialPositionDelta, startSpeed,
                endSpeed, acceleration, directionSign);
        assertEquals(0, step.endSpeed);
        var expectedEndSpeed =
                step.startSpeed + step.timeDelta * step.acceleration * step.directionSign;
        assertEquals(step.endSpeed, expectedEndSpeed);
        assertTrue(step.timeDelta < initialTimeDelta);
        assertTrue(directionSign * step.positionDelta > 0);
    }
}
