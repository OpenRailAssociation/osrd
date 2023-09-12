package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;

public record LegacySTDCMStep(
        Collection<Pathfinding.EdgeLocation<SignalingRoute>> locations,
        double duration,
        boolean stop
)
{}
