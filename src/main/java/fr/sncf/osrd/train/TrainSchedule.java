package fr.sncf.osrd.train;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import fr.sncf.osrd.train.decisions.TrainDecisionMaker;
import fr.sncf.osrd.train.phases.NavigatePhase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class TrainSchedule {
    public final String trainID;
    public final RollingStock rollingStock;

    public final double departureTime;

    public final TrackSectionLocation initialLocation;
    public final EdgeDirection initialDirection;
    public final Route initialRoute;
    public final double initialSpeed;

    public final ArrayList<NavigatePhase> phases;

    public final TrainDecisionMaker trainDecisionMaker;

    /** This is the *expected* path, eventually it may change in the TrainState copy */
    public final TrainPath plannedPath;

    public SpeedInstructions speedInstructions;

    public List<TrainStop> stops;

    /** Create a new train schedule */
    public TrainSchedule(
            String trainID,
            RollingStock rollingStock,
            double departureTime,
            TrackSectionLocation initialLocation,
            EdgeDirection initialDirection, Route initialRoute,
            double initialSpeed,
            ArrayList<NavigatePhase> phases,
            TrainDecisionMaker trainDecisionMaker,
            TrainPath plannedPath,
            SpeedInstructions speedInstructions,
            List<TrainStop> stops) {
        this.trainID = trainID;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialLocation = initialLocation;
        this.initialDirection = initialDirection;
        this.initialRoute = initialRoute;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
        this.plannedPath = plannedPath;
        if (stops == null)
            this.stops = Collections.singletonList(new TrainStop(plannedPath.length - 1e-3, 0));
        else
            this.stops = stops;
        if (trainDecisionMaker == null)
            trainDecisionMaker = new TrainDecisionMaker.DefaultTrainDecisionMaker();
        this.trainDecisionMaker = trainDecisionMaker;
        this.speedInstructions = speedInstructions;
    }
}
