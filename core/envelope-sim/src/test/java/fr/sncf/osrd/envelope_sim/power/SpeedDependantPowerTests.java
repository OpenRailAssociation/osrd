package fr.sncf.osrd.envelope_sim.power;

import org.junit.jupiter.api.Test;

import static fr.sncf.osrd.envelope_sim.power.SpeedDependantPower.constantPower;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class SpeedDependantPowerTests {

    double[] speeds = {0., 10., 15., 20., 25., 30., 65., 100., 200.};

    @Test
    public void getPowerTest() {
        var constantSpeedDependantPower = constantPower(100);
        var speedDependantPower = new SpeedDependantPower(
                new double[] {0., 10., 20., 30., 100.},
                new double[] {0., 0., 100., 100., 200.}
        );
        for (var speed: speeds) {
            var expectedConstantPower = 100.;
            var expectedPower = 0.;
            if (speed <= 10.)
                expectedPower = 0.;
            else if (speed <= 20.)
                expectedPower = (speed - 10.) / 10. * 100.;
            else if (speed <= 30)
                expectedPower = 100.;
            else if (speed <= 100.)
                expectedPower = ((speed - 30.) / 70. + 1) * 100.;
            else
                expectedPower = 200;
            assertEquals(expectedConstantPower, constantSpeedDependantPower.get(speed));
            assertEquals(expectedPower, speedDependantPower.get(speed));
        }
    }
}
