package fr.sncf.osrd;

import static fr.sncf.osrd.TestTrains.FAST_NO_FRICTION_TRAIN;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.simulation.utils.ArrayChangeLog;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.simulation.utils.SimulationError;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.timetable.TrainScheduleWaypoint;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.SignAnalyzer;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.stream.Collectors;


public class StaticSpeedLimitTest {
    @Test
    public void simpleSpeedLimitTest() throws InvalidInfraException, SimulationError {
        var infra = new Infra();
        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var edgeLength = 10000.0;
        var edge = infra.makeTopoEdge(nodeA.getIndex(), nodeB.getIndex(), "e1", edgeLength);

        // create operational points for the trip
        var opStart = new OperationalPoint("start id", "start");
        var opEnd = new OperationalPoint("end id", "end");

        // register operational points on the edge
        {
            var builder = edge.operationalPoints.builder();
            builder.add(0, opStart);
            builder.add(edgeLength, opEnd);
            builder.build();
        }

        // add the speed limits
        {
            var builder = edge.speedLimitsForward.minLimitBuilder();
            builder.add(0, 10000, 30.0);
            builder.add(5000, 6000, 25.0);
            builder.build(Double::compare);
        }

        infra.prepare();

        // create the waypoints the train should go through
        var waypoints = new CryoList<TrainScheduleWaypoint>();
        waypoints.add(new TrainScheduleWaypoint(LocalTime.ofSecondOfDay(0), 0, opStart, edge));
        waypoints.add(new TrainScheduleWaypoint(LocalTime.ofSecondOfDay(10), 0, opEnd, edge));

        // create the schedule and timetable
        var timetable = new TrainSchedule("test train", waypoints, FAST_NO_FRICTION_TRAIN, 0);
        var timetables = new CryoList<TrainSchedule>();
        timetables.add(timetable);
        timetables.freeze();
        var schedule = new Schedule(timetables);

        // initialize the simulation
        var changelog = new ArrayChangeLog();
        var sim = Simulation.create(infra, 0, schedule, changelog);

        // run the simulation
        while (!sim.isSimulationOver())
            sim.step();

        // get location changes and ensure these is only one
        var locationChanges = changelog.changes.stream()
                .filter(change -> change.getClass() == Train.LocationChange.class)
                .map(change -> (Train.LocationChange) change)
                .collect(Collectors.toList());
        assertEquals(locationChanges.size(), 1);
        var locationChange = locationChanges.get(0);

        // create the list of all speed derivative sign changes
        var profile = new ArrayList<SignAnalyzer.SignProfile>();
        var profiler = new SignAnalyzer();
        var position = 0.0;
        for (var posUpdate : locationChange.positionUpdates) {
            var profileChange = profiler.feed(posUpdate.speed);
            if (profileChange != null)
                profile.add(profileChange);
            position += posUpdate.positionDelta;
        }

        assertTrue(position <= edgeLength + 30.0);

        // speed limit
        //    +-------------------------------+        +----------------------+
        //                                    |        |
        //                                    +--------+
        // profile
        //     _______________________________          _______________________
        //    /                               \________/
        //  INCR          CONST             DECR CONST INCR       CONST
        var expectedProfileChanges = new SignAnalyzer.SignProfile[] {
                SignAnalyzer.SignProfile.INCREASING,
                SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.DECREASING,
                SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.INCREASING,
                SignAnalyzer.SignProfile.CONSTANT
        };

        assertArrayEquals(expectedProfileChanges, profile.toArray());
    }
}
