package fr.sncf.osrd.config;

@SuppressWarnings("CanBeFinal")
class JsonConfig {
    float simulationTimeStep;
    String infraPath;
    String schedulePath;
    boolean showViewer;
    boolean realTimeViewer = false;
    boolean changeReplayCheck;
    double simulationStepPause = 0;
}
