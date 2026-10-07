//! A container is a hostname and a root filesystem directory.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("container: no directory at {}", path.display())]
    Missing { path: PathBuf },
    #[error("container: {name:?} is not a valid hostname")]
    BadHostname { name: String },
}

/// At most 64 bytes (the kernel's limit), non-empty, and with no NUL or `/`, since it comes
/// from a directory name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hostname(String);

impl Hostname {
    pub fn parse(s: &str) -> Result<Hostname, Error> {
        if (1..=64).contains(&s.len()) && !s.contains(['\0', '/']) {
            Ok(Hostname(s.to_owned()))
        } else {
            Err(Error::BadHostname { name: s.to_owned() })
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone)]
pub struct Container {
    hostname: Hostname,
    rootfs: PathBuf,
}

impl Container {
    /// A bare name (not `.` or `..`) is `cwd/containers/<name>`; an argument with a `/` is
    /// `cwd.join(arg)`.
    pub fn resolve(arg: &str, cwd: &Path) -> Result<Container, Error> {
        if arg == "." || arg == ".." {
            return Err(Error::BadHostname {
                name: arg.to_owned(),
            });
        }
        let rootfs = if arg.contains('/') {
            cwd.join(arg)
        } else {
            cwd.join("containers").join(arg)
        };
        if !rootfs.is_dir() {
            return Err(Error::Missing { path: rootfs });
        }
        let name =
            rootfs
                .file_name()
                .and_then(OsStr::to_str)
                .ok_or_else(|| Error::BadHostname {
                    name: arg.to_owned(),
                })?;
        Ok(Container {
            hostname: Hostname::parse(name)?,
            rootfs,
        })
    }

    pub fn hostname(&self) -> &Hostname {
        &self.hostname
    }

    pub fn rootfs(&self) -> &Path {
        &self.rootfs
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use std::assert_matches;

    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A fresh scratch directory under the system temp dir, removed on drop.
    pub(crate) struct Scratch(PathBuf);

    impl Scratch {
        pub(crate) fn new() -> Scratch {
            static N: AtomicUsize = AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!(
                "bcdocker-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&dir).unwrap();
            Scratch(dir)
        }

        pub(crate) fn path(&self) -> &Path {
            &self.0
        }

        pub(crate) fn with_dir(self, rel: &str) -> Scratch {
            fs::create_dir_all(self.0.join(rel)).unwrap();
            self
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn a_bare_name_resolves_under_containers_in_the_working_directory() {
        let cwd = Scratch::new().with_dir("containers/tinysys");

        let c = Container::resolve("tinysys", cwd.path()).unwrap();

        assert_eq!(c.hostname().as_str(), "tinysys");
        assert_eq!(c.rootfs(), cwd.path().join("containers/tinysys"));
    }

    #[test]
    fn an_argument_with_a_slash_is_a_path_joined_to_the_working_directory() {
        let cwd = Scratch::new().with_dir("elsewhere/bctinysys");

        let relative = Container::resolve("elsewhere/bctinysys/", cwd.path()).unwrap();
        let absolute = Container::resolve(
            cwd.path().join("elsewhere/bctinysys").to_str().unwrap(),
            Path::new("/nonexistent"),
        )
        .unwrap();

        assert_eq!(relative.hostname().as_str(), "bctinysys");
        assert_eq!(relative.rootfs(), cwd.path().join("elsewhere/bctinysys/"));
        assert_eq!(absolute.hostname().as_str(), "bctinysys");
    }

    #[test]
    fn a_missing_directory_names_the_path_it_looked_for() {
        let cwd = Scratch::new();

        let err = Container::resolve("nope", cwd.path()).unwrap_err();

        assert_matches!(&err, Error::Missing { path } if *path == cwd.path().join("containers/nope"));
        assert!(err.to_string().contains("nope"));
    }

    #[test]
    fn hostnames_are_one_to_sixty_four_bytes_without_nul_or_slash() {
        assert!(Hostname::parse("tinysys").is_ok());
        assert!(Hostname::parse(&"a".repeat(64)).is_ok());
        for bad in ["", &"a".repeat(65), "a\0b", "a/b"] {
            assert_matches!(
                Hostname::parse(bad),
                Err(Error::BadHostname { .. }),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn a_bare_dot_or_dot_dot_is_a_bad_hostname_not_the_containers_directory() {
        let cwd = Scratch::new().with_dir("containers");

        for arg in [".", ".."] {
            assert_matches!(
                Container::resolve(arg, cwd.path()),
                Err(Error::BadHostname { .. }),
                "{arg:?}"
            );
        }
    }

    #[test]
    fn the_root_directory_has_no_final_component_and_is_a_bad_hostname() {
        let cwd = Scratch::new();

        let err = Container::resolve("/", cwd.path()).unwrap_err();

        assert_matches!(err, Error::BadHostname { .. });
    }
}
