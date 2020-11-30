package fr.sncf.osrd.util;

import org.dom4j.Document;
import org.dom4j.Element;
import org.dom4j.Namespace;
import org.dom4j.VisitorSupport;
import org.dom4j.tree.DefaultElement;

public class XmlNamespaceCleaner extends VisitorSupport {
    public void visit(Document document) {
        var root = document.getRootElement();
        ((DefaultElement) root).setNamespace(Namespace.NO_NAMESPACE);
        root.additionalNamespaces().clear();
    }

    public void visit(Namespace namespace) {
        namespace.detach();
    }

    public void visit(Element node) {
        if (!(node instanceof DefaultElement))
            return;

        ((DefaultElement) node).setNamespace(Namespace.NO_NAMESPACE);
    }
}
