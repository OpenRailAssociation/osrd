package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import fr.sncf.osrd.train.decisions.TrainDecisionMaker;
import fr.sncf.osrd.train.phases.NavigatePhase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class TrainSchedule {
    public final String trainID;
    public RollingStock rollingStock;

    public double departureTime;

    public final TrackSectionLocation initialLocation;
    public final Route initialRoute;
    public final double initialSpeed;

    public final List<NavigatePhase> phases;

    public final TrainDecisionMaker trainDecisionMaker;

    /** This is the *expected* path, eventually it may change in the TrainState copy */
    public final TrainPath plannedPath;

    public SpeedInstructions speedInstructions;

    public List<TrainStop> stops;

    /** Information about the train scheduled after this one, null of there isn't any */
    public TrainSuccession trainSuccession;

    /** Create a new train schedule */
    public TrainSchedule(
            String trainID,
            RollingStock rollingStock,
            double departureTime,
            TrackSectionLocation initialLocation,
            Route initialRoute,
            double initialSpeed,
            List<NavigatePhase> phases,
            TrainDecisionMaker trainDecisionMaker,
            TrainPath plannedPath,
            SpeedInstructions speedInstructions,
            List<TrainStop> stops) {
        this.trainID = trainID;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialLocation = initialLocation;
        this.initialRoute = initialRoute;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
        this.plannedPath = plannedPath;
        if (trainDecisionMaker == null)
            trainDecisionMaker = new TrainDecisionMaker.DefaultTrainDecisionMaker();
        this.trainDecisionMaker = trainDecisionMaker;
        this.speedInstructions = speedInstructions;
        initStops(stops);
    }

    private void initStops(List<TrainStop> stops) {
        if (stops == null)
            this.stops = Collections.singletonList(new TrainStop(-1, 1));
        else
            this.stops = stops;
    }

    /** Computes the total stop duration in a train schedule */
    public double getStopDuration() {
        var totalStopsDuration = 0;
        for (var stop : stops)
            totalStopsDuration += stop.stopDuration;
        return totalStopsDuration;
    }

    /** Contains data about train successions */
    public static class TrainSuccession {
        /** Schedule of the next train */
        public final TrainSchedule nextTrain;

        /** Delay between both trains in seconds */
        public final double delay;

        public TrainSuccession(TrainSchedule nextTrain, double delay) {
            this.nextTrain = nextTrain;
            this.delay = delay;
        }
    }
}
