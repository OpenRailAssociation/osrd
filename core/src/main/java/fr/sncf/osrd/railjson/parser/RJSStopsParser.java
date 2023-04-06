package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class RJSStopsParser {

    /** Parse a list of RJS stops given an infra and a path */
    public static List<TrainStop> parse(RJSTrainStop[] stops, SignalingInfra infra, TrainPath path)
            throws OSRDError {
        var res = new ArrayList<TrainStop>();
        if (stops == null) {
            throw new OSRDError(ErrorType.InvalidScheduleNoTrainStop);
        }
        for (var stop : stops) {
            if ((stop.position == null) == (stop.location == null))
                throw new OSRDError(ErrorType.InvalidScheduleMissingTrainStopLocation);
            double position;
            if (stop.position != null)
                position = stop.position;
            else
                position = path.convertTrackLocation(RJSTrackLocationParser.parse(infra, stop.location));

            if (position > path.length()) {
                // As we use different TrainPath classes for pathfinding and simulation (for now),
                // we can have small float inaccuracies for the path length, causing errors on the last stop
                // (this is temporary)
                if (position <= path.length() + 1e-5)
                    position = path.length();
                else
                    throw new OSRDError(ErrorType.InvalidScheduleOutsideTrainStopPosition);
            }

            res.add(new TrainStop(position, stop.duration));
        }
        for (var stop : res)
            if (stop.position < 0)
                stop.position = path.length();
        res.sort(Comparator.comparingDouble(stop -> stop.position));
        return res;
    }
}
