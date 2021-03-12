package fr.sncf.osrd.timetable;

import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.simulation.EntityID;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.CryoList;

import java.nio.file.Path;

public final class TrainSchedule {
    public static class TrainID implements EntityID<Train> {
        public final String trainName;

        public TrainID(String trainName) {
            this.trainName = trainName;
        }

        @Override
        public Train getEntity(Simulation sim) {
            return sim.trains.get(trainName);
        }

        @Override
        public String toString() {
            return String.format("TrainID { %s }", trainName);
        }
    }

    public final TrainID trainID;
    public final CryoList<TrainScheduleWaypoint> waypoints;
    public final RollingStock rollingStock;
    public final double initialSpeed;
    public final double driverSightDistance;
    public final TrainPath path;

    /** Create a new train schedule */
    private TrainSchedule(
            String trainID,
            CryoList<TrainScheduleWaypoint> waypoints,
            RollingStock rollingStock,
            double initialSpeed,
            double driverSightDistance,
            TrainPath path
    ) {
        this.driverSightDistance = driverSightDistance;
        this.path = path;
        // check waypoints are ordered by time
        for (int i = 1; i < waypoints.size(); i++)
            assert waypoints.get(i - 1).time.isBefore(waypoints.get(i).time);

        this.trainID = new TrainID(trainID);
        this.waypoints = waypoints;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
    }

    /** Create a new timetable from a json mapped object */
    public static TrainSchedule from(
            Infra infra,
            String trainID,
            CryoList<TrainScheduleWaypoint> waypoints,
            RollingStock rollingStock,
            double initialSpeed,
            double driverSightDistance
    ) {
        var path = TrainPath.from(infra, waypoints);
        return new TrainSchedule(trainID, waypoints, rollingStock, initialSpeed, driverSightDistance, path);
    }

    /** Create a new timetable from a json mapped object */
    public static TrainSchedule fromJson(
            Path base,
            JsonTrainSchedule json,
            Infra infra
    ) throws InvalidInfraException, InvalidTimetableException {
        assert json.waypoints != null;

        // generate waypoints
        var waypoints = new CryoList<TrainScheduleWaypoint>();
        for (var jsonEntry : json.waypoints)
            waypoints.add(TrainScheduleWaypoint.fromJson(jsonEntry, infra));
        waypoints.freeze();

        var rollingStock = ConfigManager.getRollingStock(base.resolve(json.rollingStockPath));
        var path = TrainPath.from(infra, waypoints);
        return new TrainSchedule(json.name, waypoints, rollingStock, json.initialSpeed, 400, path);
    }

    public double getDepartureTime() {
        return waypoints.first().timeSeconds();
    }
}
