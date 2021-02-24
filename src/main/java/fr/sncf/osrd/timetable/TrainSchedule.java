package fr.sncf.osrd.timetable;

import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.CryoList;

import java.nio.file.Path;

public final class TrainSchedule {
    public final String name;
    public final CryoList<TrainScheduleWaypoint> waypoints;
    public final RollingStock rollingStock;
    public final double initialSpeed;

    /**
     * Create a new train schedule
     * @param name the name of the train
     * @param waypoints the waypoints the train has to go through
     * @param rollingStock the rolling stock
     * @param initialSpeed the initial speed of the train
     */
    public TrainSchedule(
            String name,
            CryoList<TrainScheduleWaypoint> waypoints,
            RollingStock rollingStock,
            double initialSpeed) {
        // check waypoints are ordered by time
        for (int i = 1; i < waypoints.size(); i++)
            assert waypoints.get(i - 1).time.isBefore(waypoints.get(i).time);

        this.name = name;
        this.waypoints = waypoints;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
    }

    /**
     * Create a new timetable from a json mapped object
     * @param json the json mapped object
     * @param infra a reference to the infra
     */
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
        return new TrainSchedule(json.name, waypoints, rollingStock, json.initialSpeed);
    }

    public double getDepartureTime() {
        return waypoints.first().timeSeconds();
    }
}
