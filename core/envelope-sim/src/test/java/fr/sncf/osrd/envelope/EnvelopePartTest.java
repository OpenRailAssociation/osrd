package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopePhysics.getPartMechanicalEnergyConsumed;
import static fr.sncf.osrd.envelope.EnvelopePhysics.interpolateStepSpeed;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.*;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.List;

class EnvelopePartTest {
    @Test
    void toStringTest() {
        var part = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[]{1.5, 5},
                new double[]{3, 4}
        );
        assertEquals("EnvelopePart { TestAttr=A }", part.toString());
    }

    @Test
    void getAttrTest() {
        var part = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[]{1.5, 5},
                new double[]{3, 4}
        );
        assertEquals(TestAttr.A, part.getAttr(TestAttr.class));
    }

    @Test
    void interpolateSpeedTest() {
        var ep = EnvelopePart.generateTimes(
                new double[]{1.5, 5},
                new double[]{3, 4}
        );
        var interpolatedSpeed = ep.interpolateSpeed(2.75);
        // the delta here is pretty high, as we allow both approximate and exact methods
        assertEquals(3.36, interpolatedSpeed, 0.04);
    }

    @Test
    void findStep() {
        var ep = EnvelopePart.generateTimes(
                new double[]{1.5, 3, 5},
                new double[]{3, 4, 4}
        );

        assertEquals(0, ep.findLeft(1.5));
        assertEquals(0, ep.findRight(1.5));

        assertEquals(0, ep.findLeft(3));
        assertEquals(1, ep.findRight(3));

        assertEquals(1, ep.findLeft(3.5));
        assertEquals(1, ep.findRight(3.5));

        assertEquals(1, ep.findLeft(5));
        assertEquals(1, ep.findRight(5));

        assertEquals(-1, ep.findLeft(1));
        assertEquals(-4, ep.findLeft(5.1));
        assertEquals(-1, ep.findRight(1));
        assertEquals(-4, ep.findRight(5.1));
    }

    @Test
    void testEquals() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[]{1.5, 3, 5},
                new double[]{3, 4, 4}
        );
        var ep2 = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[]{1.5, 3, 5},
                new double[]{3, 4, 4}
        );
        var ep3 = EnvelopePart.generateTimes(
                List.of(TestAttr.B),
                new double[]{1.5, 3, 5},
                new double[]{3, 4, 4}
        );
        assertEquals(ep1, ep2);
        assertEquals(ep1.hashCode(), ep2.hashCode());
        assertNotEquals(ep1, ep3);
        assertNotEquals(ep1.hashCode(), ep3.hashCode());
    }

    @Test
    void testGetMechanicalEnergyConsumed() {
        var length = 50_000;
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testEffortCurveMap = SimpleRollingStock.HYPERBOLIC_EFFORT_CURVE_MAP;
        var testPath = new FlatPath(length, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, 4, testEffortCurveMap);
        var allowanceValue = new AllowanceValue.Percentage(10);

        var marecoAllowance = AllowanceTests.makeStandardMarecoAllowance(0, length, 0, allowanceValue);
        var envelopeAllowance = AllowanceTests.makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 44.4, false);

        for (var i = 0; i < envelopeAllowance.size(); i++) {
            var envelopePart = envelopeAllowance.get(i);
            var envelopePartEnergy = getPartMechanicalEnergyConsumed(
                    envelopePart,
                    testContext.path,
                    testContext.rollingStock
            );
            double expectedEnvelopePartEnergy;
            switch (i) {
                case 0:
                    expectedEnvelopePartEnergy =
                            testRollingStock.getMaxTractionForce(1, testEffortCurveMap.get(0.), true)
                            * envelopePart.getTotalTimeMS() / 1000;
                    break;
                case 1:
                    Assertions.assertEquals(envelopePart.getMinSpeed(), envelopePart.getMaxSpeed());
                    expectedEnvelopePartEnergy = testRollingStock
                            .getRollingResistance(envelopePart.getBeginSpeed()) * envelopePart.getTotalDistance();
                    break;
                case 2:
                    expectedEnvelopePartEnergy = 0;
                    break;
                case 3:
                    assertTrue(envelopePartEnergy <= 0);
                    continue;
                default:
                    expectedEnvelopePartEnergy = 0;
            }
            assertEquals(
                    expectedEnvelopePartEnergy,
                    envelopePartEnergy,
                    0.1 * expectedEnvelopePartEnergy + 1000
            );
        }
    }
}