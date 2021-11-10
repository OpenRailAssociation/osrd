package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.railscript.value.RSValue;

public interface RSDelayHandler {
    void planDelayedUpdate(int index, RSValue value, double delay);
}
