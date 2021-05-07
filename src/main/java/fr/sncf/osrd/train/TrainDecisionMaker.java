package fr.sncf.osrd.train;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;

import java.util.ArrayList;

public abstract class TrainDecisionMaker {

    protected TrainState trainState = null;

    public void setTrainState(TrainState trainState) {
        this.trainState = trainState;
    }

    protected SpeedController[] getActiveSpeedControllers() {
        var activeControllers = new ArrayList<SpeedController>();
        // Add train speed controllers
        for (var controller : trainState.speedControllers) {
            if (!controller.isActive(trainState))
                continue;
            activeControllers.add(controller);
        }
        // Add phase speed controllers
        for (var controller : trainState.currentPhaseState.getSpeedControllers()) {
            if (!controller.isActive(trainState))
                continue;
            activeControllers.add(controller);
        }
        return activeControllers.toArray(new SpeedController[0]);
    }

    public Action getNextAction(Train.TrainStateChange locationChange, TrainPhysicsIntegrator integrator) {
        assert trainState != null;

        var prevLocation = trainState.location.getPathPosition();

        // get the list of active speed controllers
        var speedControllers = getActiveSpeedControllers();
        locationChange.speedControllersUpdates.dedupAdd(prevLocation, speedControllers);

        // get the current speed directives mandated by the speed controllers
        var speedDirective = SpeedController.getDirective(speedControllers, prevLocation);
        locationChange.speedDirectivesUpdates.dedupAdd(prevLocation, speedDirective);

        return makeDecision(speedDirective, integrator);
    }

    protected abstract Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator);

    static class DefaultTrainDecisionMaker extends TrainDecisionMaker {

        @Override
        protected Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
            var rollingStock = trainState.trainSchedule.rollingStock;
            return integrator.actionToTargetSpeed(directive, rollingStock);
        }
    }
}
