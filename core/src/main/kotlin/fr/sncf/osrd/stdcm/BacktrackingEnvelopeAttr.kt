package fr.sncf.osrd.stdcm

import fr.sncf.osrd.utils.SelfTypeHolder

class BacktrackingSelfTypeHolder : SelfTypeHolder {
    override val selfType: Class<out SelfTypeHolder>
        get() = BacktrackingSelfTypeHolder::class.java
}
