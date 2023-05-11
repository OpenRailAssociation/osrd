package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.reporting.exceptions.NotImplemented;
import org.jetbrains.annotations.NotNull;
import java.util.ArrayList;
import java.util.List;

public class StandaloneSimulationCommand implements CliCommand {

    @Parameter(
            names = {"--infra_path"},
            description = "Path to the infra railjson file to load",
            required = true
    )
    private String infraFilePath;

    @Parameter(
            names = {"--sim_path"},
            description = "Path to the sim railjson file to load",
            required = true
    )
    private String simFilePath;

    @Parameter(
            names = {"--res_path"},
            description = "Path to the result file to save",
            required = true
    )
    private String resultFilePath;

    @Override
    public int run() {
        throw new NotImplemented();
    }


    public static class TrainScheduleGroup {
        /** The waypoints to use for pathfinding */
        public PathfindingWaypoint[][] waypoints;

        /** The schedules to simulate on the path found */
        public List<RJSStandaloneTrainSchedule> schedules;

        /** The group's id. Used as a key in the mapping written as result */
        @NotNull
        public String id;

        TrainScheduleGroup() {
            id = "group.0";
            waypoints = new PathfindingWaypoint[0][];
            schedules = new ArrayList<>();
        }
    }

    public static class Input {
        public static final JsonAdapter<Input> adapter =
                new Moshi.Builder().add(ID.Adapter.FACTORY).add(RJSRollingResistance.adapter).add(RJSAllowance.adapter)
                        .add(RJSAllowanceValue.adapter).build().adapter(Input.class);

        /** The time step which shall be used for all simulations */
        @Json(name = "time_step")
        double timeStep = 2.0;

        /** A list of rolling stocks involved in the simulations */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains schedule groups */
        @Json(name = "train_schedule_groups")
        public List<TrainScheduleGroup> trainScheduleGroups;
    }
}
