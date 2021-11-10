package fr.sncf.osrd.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSTrainSuccessionTable;
import java.util.List;

public final class RJSSimulation {
    public static final JsonAdapter<RJSSimulation> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSTrainPhase.adapter)
            .add(RJSAllowance.adapter)
            .build()
            .adapter(RJSSimulation.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A list of rolling stocks involved in this simulation */
    @Json(name = "rolling_stocks")
    public List<RJSRollingStock> rollingStocks;

    /** A list of trains plannings */
    @Json(name = "train_schedules")
    public List<RJSTrainSchedule> trainSchedules;

    /** A list of TST */
    @Json(name = "train_succession_tables")
    public List<RJSTrainSuccessionTable> trainSuccessionTables;

    /** Create an RJSSimulation */
    public RJSSimulation(
            List<RJSRollingStock> rollingStocks,
            List<RJSTrainSchedule> trainSchedules,
            List<RJSTrainSuccessionTable> rjsTrainSuccessionTables
    ) {
        this.rollingStocks = rollingStocks;
        this.trainSchedules = trainSchedules;
        this.trainSuccessionTables = rjsTrainSuccessionTables;
    }
}
