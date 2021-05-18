package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.DebugViewer;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.events.TrainMoveEvent;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;

public class KeyboardInput extends TrainDecisionMaker implements KeyListener {

    private boolean accelerating = true;
    private boolean braking = false;
    private final Simulation sim;
    private Train train;

    public KeyboardInput(Simulation sim) {
        if (DebugViewer.instance == null)
            throw new RuntimeException("Can't use KeyboardInput without a DebugViewer");
        DebugViewer.instance.addKeyListener(this);
        this.sim = sim;
    }

    public void setTrain(Train train) {
        this.train = train;
    }

    @Override
    protected Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
        if (accelerating && !braking)
            return Action.accelerate(trainState.trainSchedule.rollingStock.getMaxEffort(trainState.speed));
        if (!accelerating && braking)
            return Action.brake(integrator.getMaxBrakingForce(trainState.trainSchedule.rollingStock));
        return Action.coast();
    }

    @Override
    public void keyTyped(KeyEvent e) {}

    @Override
    public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP && !accelerating) {
            accelerating = true;
            recomputeUpdates();
        }
        if (e.getKeyCode() == KeyEvent.VK_DOWN && !braking) {
            braking = true;
            recomputeUpdates();
        }
    }

    @Override
    public void keyReleased(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP && accelerating) {
            accelerating = false;
            recomputeUpdates();
        }
        if (e.getKeyCode() == KeyEvent.VK_DOWN && braking) {
            braking = false;
            recomputeUpdates();
        }
    }

    private void recomputeUpdates() {
        try {
            var newSimulationResult = trainState.evolveStateUntilPosition(sim, trainState.location.getPathPosition());

            // TODO: This cannot work that way, we need to:
            //  * Edit the last train move event, to remove changes from this point on
            //  * Add the event to the simulation in a thread safe way
            //  * Properly interrupt DebugViewer sleep() and similar loops
            TrainMoveEvent.plan(sim, trainState.time, train, newSimulationResult);

        } catch (SimulationError simulationError) {
            simulationError.printStackTrace();
        }
    }
}
