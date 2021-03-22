package fr.sncf.osrd;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.simulation.EntityID;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.phases.Phase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;

public final class TrainSchedule {
    public final TrainID trainID;
    public final RollingStock rollingStock;

    public final double departureTime;

    public final TrackSectionLocation initialLocation;
    public final EdgeDirection initialDirection;
    public final Route initialRoute;
    public final double initialSpeed;

    public final ArrayList<Phase> phases;
    public final ArrayList<TrackSectionRange> fullPath;

    /** Create a new train schedule */
    public TrainSchedule(
            String trainID,
            RollingStock rollingStock,
            double departureTime,
            TrackSectionLocation initialLocation,
            EdgeDirection initialDirection, Route initialRoute,
            double initialSpeed,
            ArrayList<Phase> phases
    ) {
        this.trainID = new TrainID(trainID);
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialLocation = initialLocation;
        this.initialDirection = initialDirection;
        this.initialRoute = initialRoute;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
        this.fullPath = new ArrayList<>();
        for (var phase : phases)
            phase.forEachPathSection(fullPath::add);
    }

    /** Find location on track given a distance from the start.
     * If the path position is higher than the fullPath length the function return null. */
    public TrackSectionLocation findLocation(double pathPosition) {
        for (var track : fullPath) {
            pathPosition -= track.length();
            if (pathPosition < 0) {
                var location = track.getBeginPosition();
                if (track.direction == EdgeDirection.START_TO_STOP)
                    location -= pathPosition;
                else
                    location += pathPosition;
                return new TrackSectionLocation(track.edge, location);
            }
        }
        return null;
    }

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
}
