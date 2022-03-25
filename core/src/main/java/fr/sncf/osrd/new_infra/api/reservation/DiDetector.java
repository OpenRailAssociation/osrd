package fr.sncf.osrd.new_infra.api.reservation;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;

public record DiDetector(Detector detector, Direction direction) {}
