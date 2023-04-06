package fr.sncf.osrd.envelope_sim.power;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static java.lang.Math.max;
import static java.lang.Math.min;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class PowerPackTests {

    double inputPower = 0.;
    double outputPower = 300e3;
    double efficiency = 0.8;

    double volume = 4; // m^3

    double capacity = 10 * 3.6e6 * volume; // Joules
    double[] initialSocValues = {0., 0.5, 0.99, 1};


    @Test
    public void getMaxOutputAndInputPowerTests() {

        for (var initialSoc: initialSocValues) {
            var powerPack =
                    PowerPack.newPowerPackDiesel(inputPower, outputPower, capacity, efficiency, initialSoc);
            double expectedOutputPower = outputPower * efficiency;
            if (initialSoc <= 0.)
                expectedOutputPower = 0.;
            double expectedInputPower = inputPower;
            assertEquals(expectedOutputPower, powerPack.getMaxOutputPower(0., false));
            assertEquals(expectedInputPower, powerPack.getMaxInputPower(0.));
        }
    }

    @Test
    public void consumeEnergyTest() {

        for (var initialSoc: initialSocValues) {
            var powerPack =
                    PowerPack.newPowerPackDiesel(inputPower, outputPower, capacity, efficiency, initialSoc);
            powerPack.consumeEnergy(capacity / 100);
            // we expect the SoC to drop by 1% if we consume 1% of the capacity
            double expectedSoc = max(initialSoc - 0.01, powerPack.storage.socMin);
            assertEquals(expectedSoc, powerPack.getSoc());
        }
    }

    @Test
    public void sendEnergyTest() {

        for (var initialSoc : initialSocValues) {
            var powerPack =
                    PowerPack.newPowerPackDiesel(inputPower, outputPower, capacity, efficiency, initialSoc);
            powerPack.sendEnergy(capacity / 100);
            // we expect the SoC to increase by 1% if we send 1% of the capacity
            double expectedSoc = min(initialSoc + 0.01, powerPack.storage.socMax);
            assertEquals(expectedSoc, powerPack.getSoc());
        }
    }
}
