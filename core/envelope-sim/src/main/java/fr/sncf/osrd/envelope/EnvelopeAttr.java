package fr.sncf.osrd.envelope;

/**
 * <p>Envelope parts have attributes. Attributes are stored and looked up
 * by attribute type. An envelope part thus cannot have two attributes of
 * the same type (attributes are implemented using a map from attribute
 * type to attribute value)</p>
 */
public interface EnvelopeAttr {
    /**
     * This method is called on EnvelopeAttr instances
     * to find what attribute type they belong to.
     * @see EnvelopeAttr
     */
    Class<? extends EnvelopeAttr> getAttrType();
}
