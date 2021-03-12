package fr.sncf.osrd.timetable;

import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.EntityID;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.lifestages.LifeStage;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;

public final class TrainSchedule {
    public final TrainID trainID;
    public final TrackSection startTrackSection;
    public final EdgeDirection startDirection;
    public final double startOffset;
    public final ArrayList<LifeStage> stages;
    public final RollingStock rollingStock;
    public final double initialSpeed;
    public final double driverSightDistance;
    public final double departureTime;
    public final ArrayList<TrackSectionRange> fullPath;

    /** Create a new train schedule */
    public TrainSchedule(
            String trainID,
            TrackSection startTrackSection,
            EdgeDirection startDirection,
            double startOffset,
            ArrayList<LifeStage> stages,
            RollingStock rollingStock,
            double initialSpeed,
            double driverSightDistance,
            double departureTime
    ) {
        this.startTrackSection = startTrackSection;
        this.startDirection = startDirection;
        this.startOffset = startOffset;
        this.driverSightDistance = driverSightDistance;
        this.trainID = new TrainID(trainID);
        this.stages = stages;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.departureTime = departureTime;
        this.fullPath = new ArrayList<>();
        for (var stage : stages)
            stage.forEachPathSection(fullPath::add);
    }

    /** Find location on track given a distance from the start */
    public TrackSectionLocation findLocation(double pathPosition) {
        for (var track : fullPath) {
            pathPosition -= track.edge.length;
            if (pathPosition < 0) {
                return new TrackSectionLocation(track.edge, track.getEdgeRelPosition(-pathPosition));
            }
        }
        var track = fullPath.get(fullPath.size() - 1);
        return new TrackSectionLocation(track.edge, track.getEdgeRelPosition(-pathPosition));
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
