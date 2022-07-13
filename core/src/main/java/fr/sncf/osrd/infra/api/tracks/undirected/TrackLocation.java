package fr.sncf.osrd.infra.api.tracks.undirected;

public record TrackLocation(TrackSection track, double offset) {

    /** Returns true if the tracks are equal, and the offset difference is lower than the given tolerance */
    public boolean equalsWithTolerance(TrackLocation other, double tolerance) {
        return other.track.equals(track) && Math.abs(offset - other.offset()) < tolerance;
    }
}
