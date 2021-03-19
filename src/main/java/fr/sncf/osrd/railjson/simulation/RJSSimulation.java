package fr.sncf.osrd.railjson.simulation;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.common.ID;
import fr.sncf.osrd.railjson.simulation.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.simulation.schedule.RJSTrainSchedule;

import java.util.Collection;

public class RJSSimulation {
    /** Moshi adapter used to serialize and deserialize RJSRoot */
    public static final JsonAdapter<RJSSimulation> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(RJSSimulation.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A list of rolling stocks involved in this simulation */
    @Json(name = "rolling_stocks")
    public final Collection<RJSRollingStock> rollingStocks;

    /** A list of trains plannings */
    @Json(name = "train_schedules")
    public final Collection<RJSTrainSchedule> trainSchedules;

    public RJSSimulation(
            Collection<RJSRollingStock> rollingStocks,
            Collection<RJSTrainSchedule> trainSchedules
    ) {
        this.rollingStocks = rollingStocks;
        this.trainSchedules = trainSchedules;
    }
}
