package fr.sncf.osrd.infra.state;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;

import java.util.HashMap;

@SuppressFBWarnings(value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class InfraState {
    public final Infra infra;

    final HashMap<StatefulInfraObject<?>, Object> stateMap = new HashMap<>();

    public InfraState(Infra infra) {
        this.infra = infra;
    }

    public boolean contains(StatefulInfraObject<?> object) {
        return stateMap.containsKey(object);
    }

    public void initialize(StatefulInfraObject<?> object) throws InvalidInfraException {
        if (stateMap.put(object, object.newState()) != null)
            throw new InvalidInfraException("an object was inserted twice in the infrastructure state");
    }
}
