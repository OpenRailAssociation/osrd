package fr.sncf.osrd.stdcm;

/** The given element is unavailable from timeStart until timeEnd,
 * in the space between distanceStart and distanceEnd.
 * Distances are relative to the start of the route. */
public record OccupancyBlock(
        double timeStart,
        double timeEnd,
        double distanceStart,
        double distanceEnd
){}
