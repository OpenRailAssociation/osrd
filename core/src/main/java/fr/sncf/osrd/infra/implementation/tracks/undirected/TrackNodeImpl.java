package fr.sncf.osrd.infra.implementation.tracks.undirected;

import fr.sncf.osrd.infra.api.tracks.undirected.TrackNode;

public class TrackNodeImpl {
    public static class End implements TrackNode.End {

    }

    public record Joint(String id) implements TrackNode.Joint {}
}
