package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.detection.DetectionRoute;

public interface SignalingRoute {
    DetectionRoute getInfraRoute();
}
