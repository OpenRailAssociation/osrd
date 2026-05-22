package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrackObject;
import java.util.Objects;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPointPart implements RJSTrackObject {
    @Json(name = "local_track_name")
    @Nullable
    public String localTrackName;

    @Nullable
    public RJSOperationalPointPartExtensions extensions;

    public String track;
    public double position;

    public RJSOperationalPointPart(
            @NotNull String track,
            double position,
            @Nullable String localTrackName,
            @Nullable RJSOperationalPointPartExtensions extensions) {
        this.track = track;
        this.position = position;
        this.localTrackName = localTrackName;
        this.extensions = extensions;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSOperationalPointPart that)) return false;
        return Double.compare(position, that.position) == 0 && Objects.equals(track, that.track);
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, track);
    }

    public double getPosition() {
        return position;
    }

    @NotNull
    public String getTrack() {
        return track;
    }
}
