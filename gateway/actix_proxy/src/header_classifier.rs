use actix_web::http::header::{self, HeaderMap, HeaderValue};
use smallvec::{SmallVec, smallvec};

static STANDARD_HOP_BY_HOP_HEADERS: phf::Set<&'static str> = phf::phf_set! {
    "keep-alive",
    "transfer-encoding",
    "te",
    "connection",
    "trailer",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
    "sec-websocket-key",
    "sec-websocket-extensions",
    "sec-websocket-version",
    "sec-websocket-accept",
};

pub(crate) struct HeaderClassifier<'a> {
    connection_headers: SmallVec<[&'a [u8]; 4]>,
}

impl<'a> HeaderClassifier<'a> {
    pub fn from_connection_header_bytes(conn_header: Option<&'a [u8]>) -> Self {
        let Some(conn_header) = conn_header else {
            return HeaderClassifier {
                connection_headers: smallvec![],
            };
        };

        let mut connection_headers = smallvec![];
        for mut header_name in conn_header.split(|c| *c == b',') {
            while let Some(stripped_name) = header_name.strip_prefix(b" ") {
                header_name = stripped_name;
            }
            while let Some(stripped_name) = header_name.strip_suffix(b" ") {
                header_name = stripped_name;
            }
            connection_headers.push(header_name);
        }

        HeaderClassifier { connection_headers }
    }

    pub fn from_connection_header(conn_header: Option<&'a HeaderValue>) -> Self {
        Self::from_connection_header_bytes(conn_header.map(|e| e.as_bytes()))
    }

    pub fn from_headermap(header_map: &'a HeaderMap) -> Self {
        Self::from_connection_header(header_map.get(header::CONNECTION))
    }

    pub fn forwardable(&self, header: impl AsRef<str>) -> bool {
        self.forwardable_str(header.as_ref())
    }

    fn forwardable_str(&self, header: &str) -> bool {
        if STANDARD_HOP_BY_HOP_HEADERS.contains(header) {
            return false;
        }

        let header_name_bytes = header.as_bytes();
        for conn_header in self.connection_headers.iter() {
            if header_name_bytes.eq_ignore_ascii_case(conn_header) {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static CONNECTION_HEADER_CASES: &[&[u8]] = &[b"foo, bar", b"foo,bar", b"   foo  ,   bar  "];

    static CASES: &[(&str, bool)] = &[
        ("foo", false),
        ("bar", false),
        ("keep-alive", false),
        ("foooo", true),
    ];

    #[test]
    fn test_header_classifier() {
        for conn_header in CONNECTION_HEADER_CASES {
            let classifier = HeaderClassifier::from_connection_header_bytes(Some(conn_header));
            for (case, expected) in CASES {
                assert_eq!(
                    classifier.forwardable(case),
                    *expected,
                    "with conn header '{conn_header:?}' header '{case}' was incorrectly classified",
                );
            }
        }
    }
}
