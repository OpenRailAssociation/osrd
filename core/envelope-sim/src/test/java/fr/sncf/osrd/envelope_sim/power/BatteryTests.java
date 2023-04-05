package fr.sncf.osrd.envelope_sim.power;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class BatteryTests {

    @Test
    public void getMaxOutputAndInputPowerTests() {
        var inputPower = 300e3;
        var outputPower = 300e3;
        var efficiency = 0.8;

        var initialSocValues = new double[]{0.2, 0.5, 0.79, 0.8};

        for (var initialSoc: initialSocValues) {
            var battery = Battery.newBattery(inputPower, outputPower, efficiency, initialSoc);
            double expectedOutputPower = outputPower * efficiency;
            if (initialSoc <= 0.2)
                expectedOutputPower = 0.;
            double expectedInputPower = inputPower;
            if (initialSoc > 0.7)
                // if the initial soc is too high, we expect the max input power to be capped by the refill law
                expectedInputPower = battery.storage.refillLaw.getRefillPower(initialSoc);
            assertEquals(expectedOutputPower, battery.getMaxOutputPower(0., false));
            assertEquals(expectedInputPower, battery.getMaxInputPower(0.));
        }
    }
}
