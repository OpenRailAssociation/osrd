package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.DebugViewer;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;

public class KeyboardInput extends InteractiveInput implements KeyListener {

    private boolean accelerating = false;
    private boolean braking = false;

    public KeyboardInput(double dt) {
        super(dt);
        DebugViewer.addKeyListener(this);
    }

    @Override
    public Action getNextAction(SpeedDirective speedDirective, TrainPhysicsIntegrator integrator) {
        if (accelerating && !braking)
            return Action.accelerate(trainState.trainSchedule.rollingStock.getMaxEffort(trainState.speed));
        if (!accelerating && braking)
            return Action.brake(integrator.getBrakingForce(trainState.trainSchedule.rollingStock));
        return Action.coast();
    }

    @Override
    public void keyTyped(KeyEvent e) {}

    @Override
    public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = true;
        else if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = true;
        else if (e.getKeyCode() == KeyEvent.VK_ESCAPE)
            quit = true;
    }

    @Override
    public void keyReleased(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = false;
        else if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = false;
    }
}
