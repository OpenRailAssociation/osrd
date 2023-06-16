package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.standalone_sim.StandaloneSim.generateAllowanceFromScheduledPoints;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.train.ScheduledPoint;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

public class StandaloneSimTests {
    @Test
    public void generateAllowanceFromOneScheduledPoint() {
        var envelopeFloor = Envelope.make(EnvelopePart.generateTimes(
                new double[] {0, 1, 2, 3, 4, 5, 6},
                new double[] {1, 1, 1, 1, 1, 1, 1}
        ));
        var envelopeStopWrapper = new EnvelopeStopWrapper(envelopeFloor, List.of());
        var scheduledPoints = new ArrayList<ScheduledPoint>();
        scheduledPoints.add(new ScheduledPoint(2, 5));
        var allowanceOpt = generateAllowanceFromScheduledPoints(envelopeStopWrapper, scheduledPoints);
        Assertions.assertFalse(allowanceOpt.isEmpty());
        var allowance = allowanceOpt.get();
        Assertions.assertEquals(allowance.ranges.size(), 1);
        var rangeAllowance = allowance.ranges.get(0);
        Assertions.assertEquals(0., rangeAllowance.beginPos, 0.0001);
        Assertions.assertEquals(2., rangeAllowance.endPos, 0.0001);
        Assertions.assertEquals(3., rangeAllowance.value.getAllowanceTime(2., 2.), 0.0001);
    }

    @Test
    public void generateAllowanceFromMultipleScheduledPoints() {
        var envelopeFloor = Envelope.make(EnvelopePart.generateTimes(
                new double[] {0, 1, 2, 3, 4, 5, 6},
                new double[] {1, 1, 1, 1, 1, 1, 1}
        ));
        var envelopeStopWrapper = new EnvelopeStopWrapper(envelopeFloor, List.of());
        var scheduledPoints = new ArrayList<ScheduledPoint>();
        scheduledPoints.add(new ScheduledPoint(2, 5));
        scheduledPoints.add(new ScheduledPoint(4, 12));
        var allowanceOpt = generateAllowanceFromScheduledPoints(envelopeStopWrapper, scheduledPoints);
        Assertions.assertFalse(allowanceOpt.isEmpty());
        var allowance = allowanceOpt.get();
        Assertions.assertEquals(allowance.ranges.size(), 2);
        var rangeAllowance = allowance.ranges.get(0);
        Assertions.assertEquals(0., rangeAllowance.beginPos, 0.0001);
        Assertions.assertEquals(2., rangeAllowance.endPos, 0.0001);
        Assertions.assertEquals(3., rangeAllowance.value.getAllowanceTime(2., 2.), 0.0001);
        rangeAllowance = allowance.ranges.get(1);
        Assertions.assertEquals(2., rangeAllowance.beginPos, 0.0001);
        Assertions.assertEquals(4., rangeAllowance.endPos, 0.0001);
        Assertions.assertEquals(5., rangeAllowance.value.getAllowanceTime(2., 2.), 0.0001);
    }

    @Test
    public void generateAllowanceFromNoScheduledPoints() {
        var envelopeFloor = Envelope.make(EnvelopePart.generateTimes(
                new double[] {0, 1, 2, 3, 4, 5, 6},
                new double[] {1, 1, 1, 1, 1, 1, 1}
        ));
        var envelopeStopWrapper = new EnvelopeStopWrapper(envelopeFloor, List.of());
        var scheduledPoints = new ArrayList<ScheduledPoint>();
        var allowanceOpt = generateAllowanceFromScheduledPoints(envelopeStopWrapper, scheduledPoints);
        Assertions.assertTrue(allowanceOpt.isEmpty());
    }
}
