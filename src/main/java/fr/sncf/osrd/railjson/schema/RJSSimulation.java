package fr.sncf.osrd.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;

import java.util.Collection;

public final class RJSSimulation {
    public static final JsonAdapter<RJSSimulation> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSTrainPhase.adapter)
            .add(RJSRunningTimeParameters.adapter)
            .build()
            .adapter(RJSSimulation.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A list of rolling stocks involved in this simulation */
    @Json(name = "rolling_stocks")
    public Collection<RJSRollingStock> rollingStocks;

    /** A list of trains plannings */
    @Json(name = "train_schedules")
    public Collection<RJSTrainSchedule> trainSchedules;

    public RJSSimulation(
            Collection<RJSRollingStock> rollingStocks,
            Collection<RJSTrainSchedule> trainSchedules
    ) {
        this.rollingStocks = rollingStocks;
        this.trainSchedules = trainSchedules;
    }
}
