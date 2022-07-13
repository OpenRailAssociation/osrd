package fr.sncf.osrd.infra.api.reservation;

import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;

public record DiDetector(Detector detector, Direction direction) {}
