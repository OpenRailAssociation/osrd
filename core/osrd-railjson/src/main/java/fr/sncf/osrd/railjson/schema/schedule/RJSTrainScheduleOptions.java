package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;

public class RJSTrainScheduleOptions {
    /** Optional arguments for the standalone simulation */

    @Json(name = "ignore_electrical_profiles")
    public Boolean ignoreElectricalProfiles;

    public RJSTrainScheduleOptions(Boolean ignoreElectricalProfiles) {
        this.ignoreElectricalProfiles = ignoreElectricalProfiles;
    }
}
