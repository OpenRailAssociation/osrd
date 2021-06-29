package fr.sncf.osrd.cbtc;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.function.Consumer;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.TrainStatus;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.phases.Phase;
import fr.sncf.osrd.train.phases.PhaseState;
import fr.sncf.osrd.utils.TrackSectionLocation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CBTCPhase implements Phase {
    public final List<Route> routePath;
    public final TrackSectionLocation endLocation;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    public transient SpeedControllerGenerator targetSpeedGenerator;

    private CBTCPhase(
        List<Route> routePath,
        TrackSectionLocation endLocation,
        ArrayList<TrackSectionRange> trackSectionPath,
        SpeedControllerGenerator targetSpeedGenerator) {
        this.routePath = routePath;
        this.endLocation = endLocation;
        this.trackSectionPath = trackSectionPath;
        this.targetSpeedGenerator = targetSpeedGenerator;
}   

        /** Create a new navigation phase from an already determined path */
    public static CBTCPhase from(
            List<Route> routes,
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            SpeedControllerGenerator targetSpeedGenerator
    ) {
        var trackSectionPath = Route.routesToTrackSectionRange(routes, startLocation, endLocation);
        return new CBTCPhase(routes, endLocation, trackSectionPath, targetSpeedGenerator);
    }
    
    public PhaseState getState(Simulation sim, TrainSchedule schedule) {
        return new CBTCPhase.CBTCPhaseState(this, sim, schedule);
    }

    public TrackSectionLocation getEndLocation() {
        return endLocation;
    }

    public void forEachPathSection(Consumer<TrackSectionRange> consumer) {
        trackSectionPath.forEach(consumer);
    }

    public static final class CBTCPhaseState extends PhaseState {
        static final Logger logger = LoggerFactory.getLogger(CBTCPhaseState.class);

        public final CBTCPhase phase;
        private int routeIndex = 0;
        private final transient Simulation sim;
        private final transient TrainSchedule schedule;
        private final transient HashMap<Signal, ArrayList<SpeedController>> signalControllers;

        CBTCPhaseState(CBTCPhase phase, Simulation sim, TrainSchedule schedule) {
            super(phase.targetSpeedGenerator);
            this.sim = sim;
            this.schedule = schedule;
            speedInstructions.generate(sim, schedule);
            this.phase = phase;
            this.signalControllers = new HashMap<>();
        }

        CBTCPhaseState(CBTCPhase.CBTCPhaseState state) {
            super(state.speedInstructions.targetSpeedGenerator);
            this.phase = state.phase;
            this.routeIndex = state.routeIndex;
            this.signalControllers = state.signalControllers;
            this.schedule = state.schedule;
            this.sim = state.sim;
            speedInstructions.generate(sim, schedule);
        }

        @Override
        public TimelineEvent simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError {
            double endOfPathPosition = 0;
            for(TrackSectionRange track : schedule.fullPath) {
                endOfPathPosition += track.length();
            }
            // TEMPORARY : fix in order to detect the end of the simulation
            if(train.getLastState().location.getPathPosition() >= endOfPathPosition || Math.abs(train.getLastState().location.getPathPosition() - endOfPathPosition) < 10) {
                var change = new Train.TrainStateChange(sim, train.getName(), trainState.nextPhase(sim));
                change.apply(sim, train);
                sim.publishChange(change);
                return null;
            }
            var simulationResult = trainState.evolveStateUntilTime(sim, sim.getTime()+0.2);
            var event = TrainMoveEvent.plan(sim, trainState.time, train, simulationResult);
            if(train.getLastState().status != TrainStatus.REACHED_DESTINATION && train.getLastState().status != TrainStatus.STOP){
                CBTCEvent.plan(sim, sim.getTime()+0.2, train);
            }
            return event;
        }

        public ArrayList<SpeedController> getSpeedControllers() {
            TrainState trainState = sim.trains.get(schedule.trainID).getLastState();
            if(trainState != null) {
                CBTCATP atp = new CBTCATP(sim, schedule, trainState);
                return atp.directive();
            }
            return new ArrayList<SpeedController>();
        }

        public int getRouteIndex() {
            return routeIndex;
        }

        @Override
        public PhaseState clone() {
            return new CBTCPhase.CBTCPhaseState(this);
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(PhaseState other) {
            if (other.getClass() != CBTCPhaseState.class)
                return false;
            var o = (CBTCPhaseState) other;
            return o.phase == phase && o.routeIndex == routeIndex;
        }
    }

}
