package fr.sncf.osrd.simulation.changelog;

import fr.sncf.osrd.simulation.Change;

public interface ChangeLog extends Iterable<Change> {
    int size();
}
