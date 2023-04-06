package fr.sncf.osrd.envelope_sim.power;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static java.lang.Math.max;
import static java.lang.Math.min;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class BatteryTests {

    double inputPower = 300e3;
    double outputPower = 300e3;
    double efficiency = 0.8;

    double capacity = 300 * 3.6e6;

    double[] initialSocValues = {0.2, 0.5, 0.79, 0.8};


    @Test
    public void getMaxOutputAndInputPowerTests() {

        for (var initialSoc: initialSocValues) {
            var battery = Battery.newBattery(inputPower, outputPower, capacity, efficiency, initialSoc);
            double expectedOutputPower = outputPower * efficiency;
            if (initialSoc <= 0.2)
                expectedOutputPower = 0.;
            double expectedInputPower = inputPower / efficiency;
            if (initialSoc > 0.7)
                // if the initial soc is too high, we expect the max input power to be capped by the refill law
                expectedInputPower = battery.storage.refillLaw.getRefillPower(initialSoc) / efficiency;
            assertEquals(expectedOutputPower, battery.getMaxOutputPower(0., false));
            assertEquals(expectedInputPower, battery.getMaxInputPower(0., false));
        }
    }

    @Test
    public void consumeEnergyTest() {

        for (var initialSoc: initialSocValues) {
            var battery = Battery.newBattery(inputPower, outputPower, capacity, efficiency, initialSoc);
            battery.consumeEnergy(capacity / 100);
            // we expect the SoC to drop by 1% if we consume 1% of the capacity
            double expectedSoc = max(initialSoc - 0.01, battery.storage.socMin);
            assertEquals(expectedSoc, battery.getSoc());
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
