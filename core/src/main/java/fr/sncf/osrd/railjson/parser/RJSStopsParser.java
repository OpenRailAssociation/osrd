package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.PathKt;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.units.Distance;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class RJSStopsParser {

    /** Parse a list of RJS stops given an infra and a path */
    public static List<TrainStop> parse(RJSTrainStop[] stops, RawSignalingInfra infra, Path path)
            throws OSRDError {
        var res = new ArrayList<TrainStop>();
        if (stops == null) {
            throw new OSRDError(ErrorType.InvalidScheduleNoTrainStop);
        }
        for (var stop : stops) {
            if ((stop.position == null) == (stop.location == null))
                throw new OSRDError(ErrorType.InvalidScheduleMissingTrainStopLocation);
            long positionMM;
            if (stop.position != null)
                positionMM = Distance.fromMeters(stop.position);
            else
                positionMM = PathKt.getOffsetOfTrackLocationOrThrow(path,
                        RJSTrackLocationParser.parse(infra, stop.location));

            if (positionMM > path.getLength())
                throw new OSRDError(ErrorType.InvalidScheduleOutsideTrainStopPosition);

            res.add(new TrainStop(Distance.toMeters(positionMM), stop.duration));
        }
        for (var stop : res)
            if (stop.position < 0)
                stop.position = Distance.toMeters(path.getLength());
        res.sort(Comparator.comparingDouble(stop -> stop.position));
        return res;
    }
}
