package fr.sncf.osrd.new_infra.api.detection;

import com.google.common.collect.ImmutableList;

public interface DetectionRoute {
    ImmutableList<Detector> getReleasePoints();
}
