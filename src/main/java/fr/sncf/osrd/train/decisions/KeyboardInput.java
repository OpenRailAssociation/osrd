package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.DebugViewer;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;

public class KeyboardInput extends TrainDecisionMaker implements KeyListener {

    private boolean accelerating = true;
    private boolean braking = false;

    public KeyboardInput() {
        if (DebugViewer.instance == null)
            throw new RuntimeException("Can't use KeyboardInput without a DebugViewer");
        DebugViewer.instance.addKeyListener(this);
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
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = true;
        if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = true;
    }

    @Override
    public void keyReleased(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = false;
        if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = false;
    }
}
