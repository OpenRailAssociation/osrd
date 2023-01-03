package fr.sncf.osrd.railjson.schema.infra.trackranges;

public class RJSTrackRange extends RJSRange {
    public String track;

    public RJSTrackRange(String track, double begin, double end) {
        super(begin, end);
        this.track = track;
    }
}
