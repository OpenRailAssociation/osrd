package fr.sncf.osrd.envelope_sim.power;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static java.lang.Math.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class CatenaryTests {

    double inputPower = 0.;
    double outputPower = 300e3;
    double efficiency = 0.8;

    double speedTransitionLow = 10.; // the speed under which the power transmission is limited

    double speedTransitionHigh = 20.; // the speed at which the power transmission reaches its maximum

    Catenary catenary = Catenary.newCatenary(
            inputPower, outputPower, speedTransitionLow, speedTransitionHigh, efficiency
    );

    double[] speeds = {
            0.,
            speedTransitionLow,
            (speedTransitionLow + speedTransitionHigh) / 2,
            speedTransitionHigh,
            2 * speedTransitionHigh
    };

    @Test
    public void getMaxOutputAndInputPowerTests() {
        for (var speed : speeds) {
            double expectedOutputPower = outputPower;
            double expectedInputPower = inputPower;
            if (speed <= speedTransitionLow) {
                expectedOutputPower = outputPower / 2;
                expectedInputPower = inputPower / 2;
            }
            else if (speed <= speedTransitionHigh) {
                var coef = ((speed - speedTransitionLow) / (speedTransitionHigh - speedTransitionLow) + 1 ) / 2;
                expectedOutputPower = coef * outputPower;
                expectedInputPower = coef * inputPower;
            }
            expectedOutputPower *= efficiency;
            expectedInputPower /= efficiency;
            assertEquals(expectedOutputPower, catenary.getMaxOutputPower(speed, true));
            assertEquals(expectedInputPower, catenary.getMaxInputPower(speed, true));
        }
    }
}
