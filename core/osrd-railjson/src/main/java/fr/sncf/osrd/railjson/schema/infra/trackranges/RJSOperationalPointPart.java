package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrackObject;
import java.util.Objects;
import org.jetbrains.annotations.Nullable;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPointPart extends RJSTrackObject {
    @Nullable
    public RJSOperationalPointPartExtensions extensions;

    public RJSOperationalPointPart(
            String track, double position, @Nullable RJSOperationalPointPartExtensions extensions) {
        this.track = track;
        this.position = position;
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
}
