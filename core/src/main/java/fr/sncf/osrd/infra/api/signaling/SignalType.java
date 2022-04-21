package fr.sncf.osrd.infra.api.signaling;

public interface SignalType<InT extends SignalState, OutT extends SignalState> {
    /** The signal type name is used to deserialize signal types */
    String getName();

    Class<InT> getInputType();

    Class<OutT> getOutputType();

    /** Creates a new signal type */
    static <InT extends SignalState, OutT extends SignalState>
            SignalType<InT, OutT> make(String name, Class<InT> inputType, Class<OutT> outputType) {
        return new SignalType<InT, OutT>() {
            @Override
            public String getName() {
                return name;
            }

            @Override
            public Class<InT> getInputType() {
                return inputType;
            }

            @Override
            public Class<OutT> getOutputType() {
                return outputType;
            }
        };
    }
}
