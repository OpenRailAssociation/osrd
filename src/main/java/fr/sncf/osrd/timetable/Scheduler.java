package fr.sncf.osrd.timetable;

import com.badlogic.ashley.core.EntitySystem;
import fr.sncf.osrd.SystemOrdering;

public class Scheduler extends EntitySystem {
    public Scheduler() {
        super(SystemOrdering.TIMETABLE.getPriority());
    }
}
