package fr.sncf.osrd.railjson.schema.schedule;

public abstract class RJSRunningTimeParameters {
    public String type;


    public static final class Eco extends RJSRunningTimeParameters {

    }

    public static final class Typical extends RJSRunningTimeParameters {
        public String marginType;
        public double marginValue;
    }

}
