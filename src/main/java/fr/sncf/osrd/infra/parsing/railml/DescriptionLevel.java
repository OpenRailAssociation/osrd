package fr.sncf.osrd.infra.parsing.railml;

public enum DescriptionLevel {
    MICRO, MESO, MACRO;

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
