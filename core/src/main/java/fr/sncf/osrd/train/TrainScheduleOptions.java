package fr.sncf.osrd.train;

import fr.sncf.osrd.railjson.schema.schedule.RJSTrainScheduleOptions;

public class TrainScheduleOptions {
    /** Optional arguments for the standalone simulation */
    public boolean ignoreElectricalProfiles;

    /** Construct options from a RailJSON object */
    public TrainScheduleOptions(RJSTrainScheduleOptions options) {
        if (options == null || options.ignoreElectricalProfiles == null)
            ignoreElectricalProfiles = false;
        else
            ignoreElectricalProfiles = options.ignoreElectricalProfiles;
    }
}
