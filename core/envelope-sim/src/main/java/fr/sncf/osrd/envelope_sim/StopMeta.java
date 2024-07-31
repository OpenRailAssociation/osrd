package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.utils.SelfTypeHolder;
import org.jetbrains.annotations.NotNull;

public final class StopMeta implements SelfTypeHolder {
    public final int stopIndex;

    public StopMeta(int stopIndex) {
        this.stopIndex = stopIndex;
    }

    @Override
    public @NotNull Class<? extends SelfTypeHolder> getSelfType() {
        return StopMeta.class;
    }
}
