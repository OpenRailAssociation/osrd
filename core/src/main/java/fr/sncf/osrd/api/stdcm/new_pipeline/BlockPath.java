package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.envelope_sim.PhysicsPath;
import java.util.Set;

/** This is the result of the pathfinding step,
 * made of a physical path part and time intervals that can be used for each position.
 * The distances in the OccupancyBlocks are relative to the start of the path. */
public record BlockPath(
        PhysicsPath path,
        Set<OccupancyBlock> blocks
) {}
