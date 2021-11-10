package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.*;
import java.util.HashSet;
import java.util.Set;

public abstract class TrainDecisionMaker {

    protected TrainState trainState = null;

    public void setTrainState(TrainState trainState) {
        this.trainState = trainState;
    }

    public abstract Action getNextAction(SpeedDirective speedDirective, TrainPhysicsIntegrator integrator);

    public TrainEvolutionEvent simulatePhase(Train train, Simulation sim) throws SimulationError {
        return trainState.currentPhaseState.simulate(train, trainState);
    }

    /** Return a list of active controller.
     *  If isLate is true this function uses the max speed controller to catch up with the target time.
     */
    public Set<SpeedController> getActiveSpeedControllers(boolean isLate) {
        var speedInstructions = trainState.trainSchedule.speedInstructions;
        var activeControllers = new HashSet<SpeedController>();
        // Add train speed controllers
        Set<SpeedController> targetControllers;
        if (isLate)
            targetControllers = speedInstructions.maxSpeedControllers;
        else
            targetControllers = speedInstructions.targetSpeedControllers;
        for (var controller : targetControllers) {
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
        return activeControllers;
    }

    public static class DefaultTrainDecisionMaker extends TrainDecisionMaker {

        @Override
        public Action getNextAction(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
            var rollingStock = trainState.trainSchedule.rollingStock;
            return integrator.actionToTargetSpeed(directive, rollingStock);
        }
    }
}
