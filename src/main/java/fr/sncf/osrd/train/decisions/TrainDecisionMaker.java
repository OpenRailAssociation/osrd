package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainState;

import java.util.ArrayList;

public abstract class TrainDecisionMaker {

    protected TrainState trainState = null;

    public void setTrainState(TrainState trainState) {
        this.trainState = trainState;
    }

    public Action getNextAction(Train.TrainStateChange locationChange, TrainPhysicsIntegrator integrator) {
        assert trainState != null;

        var prevLocation = trainState.location.getPathPosition();

        // get the list of active speed controllers
        var speedControllers = trainState.getActiveSpeedControllers();
        locationChange.speedControllersUpdates.dedupAdd(prevLocation, speedControllers);

        // get the current speed directives mandated by the speed controllers
        var speedDirective = SpeedController.getDirective(speedControllers, prevLocation);
        locationChange.speedDirectivesUpdates.dedupAdd(prevLocation, speedDirective);

        return makeDecision(speedDirective, integrator);
    }

    protected abstract Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator);

    public TimelineEvent simulatePhase(Train train, Simulation sim) throws SimulationError {
        return trainState.currentPhaseState.simulate(sim, train, trainState);
    }

    public static class DefaultTrainDecisionMaker extends TrainDecisionMaker {

        @Override
        protected Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
            var rollingStock = trainState.trainSchedule.rollingStock;
            return integrator.actionToTargetSpeed(directive, rollingStock);
        }
    }
}
