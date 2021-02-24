package fr.sncf.osrd.utils;

import org.dom4j.Document;
import org.dom4j.Element;
import org.dom4j.Namespace;
import org.dom4j.VisitorSupport;
import org.dom4j.tree.DefaultElement;

public class XmlNamespaceCleaner extends VisitorSupport {
    /**
     * Removes namespaces on the document node
     * @param document the document node
     */
    public void visit(Document document) {
        var root = document.getRootElement();
        ((DefaultElement) root).setNamespace(Namespace.NO_NAMESPACE);
        root.additionalNamespaces().clear();
    }

    /**
     * Removes Namespace nodes
     * @param namespace a namespace node to remove
     */
    public void visit(Namespace namespace) {
        namespace.detach();
    }

    /**
     * Removes namespaces on regular nodes
     * @param node a node
     */
    public void visit(Element node) {
        if (!(node instanceof DefaultElement))
            return;

        ((DefaultElement) node).setNamespace(Namespace.NO_NAMESPACE);
    }
}
