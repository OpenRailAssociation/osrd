package fr.sncf.osrd.timetable;

import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.EntityID;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.phases.Phase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;

public final class TrainSchedule {
    public final TrainID trainID;
    public final TrackSection startTrackSection;
    public final EdgeDirection startDirection;
    public final double startOffset;
    public final ArrayList<Phase> phases;
    public final RollingStock rollingStock;
    public final double initialSpeed;
    public final double departureTime;
    public final ArrayList<TrackSectionRange> fullPath;

    /** Create a new train schedule */
    public TrainSchedule(
            String trainID,
            TrackSection startTrackSection,
            EdgeDirection startDirection,
            double startOffset,
            ArrayList<Phase> phases,
            RollingStock rollingStock,
            double initialSpeed,
            double departureTime
    ) {
        this.startTrackSection = startTrackSection;
        this.startDirection = startDirection;
        this.startOffset = startOffset;
        this.trainID = new TrainID(trainID);
        this.phases = phases;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.departureTime = departureTime;
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
