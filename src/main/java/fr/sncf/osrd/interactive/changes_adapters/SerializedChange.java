package fr.sncf.osrd.interactive.changes_adapters;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.interactive.client_messages.ChangeType;
import fr.sncf.osrd.simulation.Change;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public class SerializedChange {
    public static final PolymorphicJsonAdapterFactory<SerializedChange> adapter = (
            PolymorphicJsonAdapterFactory.of(SerializedChange.class, "change_type")
                    .withSubtype(SerializedRouteStatus.class, ChangeType.ROUTE_STATUS.name())
    );

    /** Serialize change */
    public static SerializedChange fromChange(Change change, InfraState infraState) {
        var changeType = ChangeType.fromChange(change);
        var serializedClass = changeType.serializedChangeType;
        try {
            Method fromChange = serializedClass.getMethod(
                    "fromChange",
                    changeType.internalChangeType,
                    InfraState.class
            );
            return (SerializedChange) fromChange.invoke(null, change, infraState);
        } catch (NoSuchMethodException e) {
            throw new RuntimeException(
                    String.format("Missing 'fromChange' static method for change '%s'", changeType), e);
        } catch (InvocationTargetException e) {
            throw new RuntimeException("Fail running fromChange method", e);
        } catch (IllegalAccessException e) {
            throw new RuntimeException("Wrong visibility for 'fromChange' method", e);
        }
    }
}
