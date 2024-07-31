package fr.sncf.osrd.utils

/** Used to store attributes based on their type (in Envelope parts). */
interface SelfTypeHolder {
    /**
     * This attribute is used on SelfTypeHolder instances to find what type they belong to.
     *
     * @see SelfTypeHolder
     */
    val selfType: Class<out SelfTypeHolder>
}
