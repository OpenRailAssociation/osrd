package fr.sncf.osrd.api.stdcm.new_pipeline;

/** The given element is unavailable from timeStart until timeEnd,
 * in the space between distanceStart and distanceEnd. */
public record OccupancyBlock(
        double timeStart,
        double timeEnd,
        double distanceStart,
        double distanceEnd
){}
