package fr.sncf.osrd.simulation;

import fr.sncf.osrd.utils.DeepComparable;

/**
 * This is a base class for everything that can be associated with a timeline event.
 * This is useful for statically enumerating all the types that can end up in the timeline,
 * which is very useful for serialization.
 */
public interface TimelineEventValue extends DeepComparable<TimelineEventValue> {
}
