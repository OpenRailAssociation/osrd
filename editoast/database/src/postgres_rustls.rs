//! Glue between tokio-rustls and tokio-postgres
//!
//! Allows using rustls instead of OpenSSL to connect to PostgreSQL.
//! The API is similar to `postgres-openssl`. See [MakeTlsConnector]
//!
//! Currently there are no blessed crates for this. See
//! https://github.com/rust-postgres/rust-postgres/issues/421
//! and the associated pull request.

use std::pin::Pin;
use std::sync::Arc;
use std::task::Poll;
use tokio::io::AsyncRead;
use tokio::io::AsyncWrite;
use tokio_postgres::tls::ChannelBinding;
use tokio_rustls::rustls;
use tokio_rustls::rustls::pki_types::InvalidDnsNameError;
use tokio_rustls::rustls::pki_types::ServerName;

pub struct TlsStream<S> {
    inner: tokio_rustls::client::TlsStream<S>,
}

impl<S> AsyncRead for TlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.inner).poll_read(cx, buf)
    }
}

impl<S> AsyncWrite for TlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.inner).poll_write(cx, buf)
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.inner).poll_flush(cx)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.inner).poll_shutdown(cx)
    }
}

impl<S> tokio_postgres::tls::TlsStream for TlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn channel_binding(&self) -> ChannelBinding {
        // This function is used by tokio-postgres when the account is set to
        // authenticate using SCRAM-SHA-256-PLUS:
        // https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256

        // We need to hash the TLS certificate using its hashing algorithm (or
        // SHA256 if the hashing algorithm is MD5 or SHA1, according to RFC5929
        // section 4.1)

        use aws_lc_rs::digest;
        use x509_cert::der::Decode;
        use x509_cert::der::oid::db::rfc5912 as db;

        let (_s, tls_state) = self.inner.get_ref();

        let Some([certificate_der, ..]) = tls_state.peer_certificates() else {
            return ChannelBinding::none();
        };

        let Ok(certificate) = x509_cert::Certificate::from_der(certificate_der) else {
            return ChannelBinding::none();
        };

        // Map the cert's signature algorithm to its hashing algorithm
        // (while upgrading MD5 and SHA1 to SHA256)
        // The list can be found with this command
        //     curl https://www.rfc-editor.org/rfc/rfc5912.txt | grep '\bsa-'
        let digest_algorithm = match certificate.signature_algorithm().oid {
            db::MD_5_WITH_RSA_ENCRYPTION
            | db::SHA_1_WITH_RSA_ENCRYPTION
            | db::DSA_WITH_SHA_1
            | db::DSA_WITH_SHA_256
            | db::ECDSA_WITH_SHA_256
            | db::SHA_256_WITH_RSA_ENCRYPTION => &digest::SHA256,
            db::SHA_224_WITH_RSA_ENCRYPTION | db::DSA_WITH_SHA_224 | db::ECDSA_WITH_SHA_224 => {
                &digest::SHA224
            }
            db::SHA_384_WITH_RSA_ENCRYPTION | db::ECDSA_WITH_SHA_384 => &digest::SHA384,
            db::SHA_512_WITH_RSA_ENCRYPTION | db::ECDSA_WITH_SHA_512 => &digest::SHA512,
            _ => return ChannelBinding::none(),
        };

        let hash = digest::digest(digest_algorithm, certificate_der)
            .as_ref()
            .to_vec();

        ChannelBinding::tls_server_end_point(hash)
    }
}

pub struct TlsConnect<S> {
    inner: tokio_rustls::Connect<S>,
}

impl<S> Future for TlsConnect<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    type Output = std::io::Result<TlsStream<S>>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> Poll<Self::Output> {
        match Pin::new(&mut self.inner).poll(cx) {
            Poll::Ready(Ok(inner)) => Poll::Ready(Ok(TlsStream { inner })),
            Poll::Ready(Err(err)) => Poll::Ready(Err(err)),
            Poll::Pending => Poll::Pending,
        }
    }
}

pub struct TlsConnector {
    server_name: ServerName<'static>,
    inner: tokio_rustls::TlsConnector,
}

impl<S> tokio_postgres::tls::TlsConnect<S> for TlsConnector
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    type Stream = TlsStream<S>;
    type Error = std::io::Error;
    type Future = TlsConnect<S>;

    fn connect(self, stream: S) -> Self::Future {
        let inner = self.inner.connect(self.server_name, stream);
        TlsConnect { inner }
    }
}

/// Entry point of this module, can be used with [tokio_postgres::connect].
pub struct MakeTlsConnector {
    tls_config: Arc<rustls::ClientConfig>,
}

impl MakeTlsConnector {
    pub fn new(tls_config: Arc<rustls::ClientConfig>) -> Self {
        Self { tls_config }
    }
}

impl<S> tokio_postgres::tls::MakeTlsConnect<S> for MakeTlsConnector
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    type Stream = TlsStream<S>;
    type TlsConnect = TlsConnector;
    type Error = InvalidDnsNameError;

    fn make_tls_connect(&mut self, domain: &str) -> Result<Self::TlsConnect, Self::Error> {
        let server_name = ServerName::try_from(domain)?.to_owned();
        let inner = tokio_rustls::TlsConnector::from(self.tls_config.clone());
        Ok(TlsConnector { server_name, inner })
    }
}

#[cfg(test)]
mod tests {
    use futures_util::FutureExt;
    use rustls::pki_types::pem::PemObject;
    use tokio::net::TcpStream;
    use tokio_postgres::tls::TlsConnect;

    use super::*;

    impl TlsConnector {
        fn for_tests() -> Self {
            let mut root_certificates = rustls::RootCertStore::empty();
            for cert in rustls::pki_types::CertificateDer::pem_file_iter("./ca.crt").unwrap() {
                root_certificates.add(cert.unwrap()).unwrap();
            }

            let mut tls_config = rustls::ClientConfig::builder()
                .with_root_certificates(Arc::new(root_certificates))
                .with_no_client_auth();

            // Needed for the "direct" test
            tls_config.alpn_protocols = vec![b"postgresql".to_vec()];

            let inner = tokio_rustls::TlsConnector::from(Arc::new(tls_config));

            let server_name = ServerName::try_from("localhost").unwrap();

            Self { server_name, inner }
        }
    }

    async fn smoke_test<T>(s: &str, tls: T)
    where
        T: TlsConnect<TcpStream>,
        T::Stream: 'static + Send,
    {
        let stream = TcpStream::connect("127.0.0.1:5433").await.unwrap();

        let builder = s.parse::<tokio_postgres::Config>().unwrap();
        let (client, connection) = builder.connect_raw(stream, tls).await.unwrap();

        let connection = connection.map(|r| r.unwrap());
        tokio::spawn(connection);

        let stmt = client.prepare("SELECT $1::INT4").await.unwrap();
        let rows = client.query(&stmt, &[&1i32]).await.unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].get::<_, i32>(0), 1);
    }

    #[tokio::test]
    async fn require() {
        smoke_test(
            "user=ssl_user dbname=postgres sslmode=require",
            TlsConnector::for_tests(),
        )
        .await;
    }

    #[tokio::test]
    async fn direct() {
        smoke_test(
            "user=ssl_user dbname=postgres sslmode=require sslnegotiation=direct",
            TlsConnector::for_tests(),
        )
        .await;
    }

    #[tokio::test]
    async fn prefer() {
        smoke_test("user=ssl_user dbname=postgres", TlsConnector::for_tests()).await;
    }

    #[tokio::test]
    async fn scram_user() {
        smoke_test(
            "user=scram_user password=password dbname=postgres sslmode=require",
            TlsConnector::for_tests(),
        )
        .await;
    }

    #[tokio::test]
    async fn require_channel_binding_err() {
        let connector = TlsConnector::for_tests();

        let stream = TcpStream::connect("127.0.0.1:5433").await.unwrap();
        let builder = "user=pass_user password=password dbname=postgres channel_binding=require"
            .parse::<tokio_postgres::Config>()
            .unwrap();
        builder.connect_raw(stream, connector).await.err().unwrap();
    }

    #[tokio::test]
    async fn require_channel_binding_ok() {
        smoke_test(
            "user=scram_user password=password dbname=postgres channel_binding=require",
            TlsConnector::for_tests(),
        )
        .await;
    }
}
