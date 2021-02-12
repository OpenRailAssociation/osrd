package fr.sncf.osrd.infra.topological;

public class Switch extends TrackNode {
    public Switch(String id) {
        super(id);
    }

    @Override
    public void freeze() {

    }

    @Override
    public boolean isFrozen() {
        return true;
    }
}
