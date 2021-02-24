package fr.sncf.osrd.railml;

public enum DescriptionLevel {
    MICRO,
    MESO,
    MACRO;

    /**
     * Create a new DescriptionLevel from a RailML string enum
     * @param value the string value
     * @return the enum value
     */
    public static DescriptionLevel getValue(String value) {
        assert value.equals("Micro") || value.equals("Meso") || value.equals("Macro");
        switch (value) {
            case "Micro":
                return MICRO;
            case "Meso":
                return MESO;
            default:
                return MACRO;
        }
    }
}
